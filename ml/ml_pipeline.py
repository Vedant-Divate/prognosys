# ml/ml_pipeline.py
import pandas as pd
import numpy as np
import joblib
import os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.multioutput import MultiOutputRegressor
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
import torch
import torch.nn as nn
import torch.optim as optim

# --- MODEL A: ISOLATION FOREST ---
def train_isolation_forest():
    print("\n--- Training Isolation Forest ---")
    df_train = pd.read_csv("data/healthy_baseline.csv")
    features = ["vibration_rms", "spindle_load", "temperature_c", "tool_life_pct"]

    scaler = StandardScaler()
    X_train = scaler.fit_transform(df_train[features])

    model = IsolationForest(n_estimators=200, contamination=0.05, random_state=42)
    model.fit(X_train)

    joblib.dump(scaler, "models/scaler.pkl")
    joblib.dump(model, "models/isolation_forest.pkl")
    print("Isolation Forest trained and saved.")

    # Validation on full dataset
    df_full = pd.read_csv("data/cnc_telemetry_2000.csv")
    X_full = scaler.transform(df_full[features])
    preds = model.predict(X_full)

    binary_preds = [1 if x == -1 else 0 for x in preds]
    ground_truth = [0 if x == "normal" else 1 for x in df_full["fault_class"]]
    print("Isolation Forest Validation Report:")
    print(classification_report(ground_truth, binary_preds))


# --- MODEL B: LSTM AUTOENCODER ---
class LSTMAutoencoder(nn.Module):
    def __init__(self, input_size=4, hidden_size=64, latent_size=32, seq_len=30):
        super().__init__()
        self.seq_len = seq_len
        self.enc1 = nn.LSTM(input_size, hidden_size, batch_first=True)
        self.enc2 = nn.LSTM(hidden_size, latent_size, batch_first=True)
        self.dec1 = nn.LSTM(latent_size, hidden_size, batch_first=True)
        self.dec2 = nn.LSTM(hidden_size, input_size, batch_first=True)

    def forward(self, x):
        out, _ = self.enc1(x)
        out, (h, _) = self.enc2(out)
        latent = h[-1].unsqueeze(1).repeat(1, self.seq_len, 1)
        out, _ = self.dec1(latent)
        out, _ = self.dec2(out)
        return out


def train_lstm_autoencoder():
    print("\n--- Training LSTM Autoencoder ---")
    df = pd.read_csv("data/cnc_telemetry_2000.csv")
    features = ["vibration_rms", "spindle_load", "temperature_c", "tool_life_pct"]
    normal_data = df[df["fault_class"] == "normal"][features].values

    scaler = joblib.load("models/scaler.pkl")
    scaled_data = scaler.transform(normal_data)

    # Create sliding windows
    seq_len = 30
    X = []
    for i in range(len(scaled_data) - seq_len):
        X.append(scaled_data[i:i + seq_len])
    X = np.array(X)

    X_train, X_val = train_test_split(X, test_size=0.1, random_state=42)
    train_tensor = torch.tensor(X_train, dtype=torch.float32)
    val_tensor = torch.tensor(X_val, dtype=torch.float32)

    model = LSTMAutoencoder()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    criterion = nn.MSELoss()

    best_val_loss = float("inf")
    patience = 5
    trigger_times = 0

    for epoch in range(50):
        model.train()
        optimizer.zero_grad()
        output = model(train_tensor)
        loss = criterion(output, train_tensor)
        loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            val_output = model(val_tensor)
            val_loss = criterion(val_output, val_tensor)

        print(f"Epoch {epoch + 1:02d} | Train Loss: {loss.item():.6f} | Val Loss: {val_loss.item():.6f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), "models/lstm_autoencoder.pt")
            trigger_times = 0
        else:
            trigger_times += 1
            if trigger_times >= patience:
                print(f"Early stopping at epoch {epoch + 1}")
                break

    # Compute 95th percentile threshold
    model.load_state_dict(torch.load("models/lstm_autoencoder.pt"))
    model.eval()
    with torch.no_grad():
        full_train_tensor = torch.tensor(X, dtype=torch.float32)
        reconstructions = model(full_train_tensor)
        errors = torch.mean((reconstructions - full_train_tensor) ** 2, dim=(1, 2)).numpy()

    threshold = np.percentile(errors, 95)
    np.save("models/lstm_threshold.npy", threshold)
    print(f"LSTM threshold saved: {threshold:.6f}")


def export_lstm_onnx():
    print("\n--- Exporting LSTM to ONNX ---")
    model = LSTMAutoencoder()
    model.load_state_dict(torch.load("models/lstm_autoencoder.pt"))
    model.eval()

    dummy_input = torch.randn(1, 30, 4)
    torch.onnx.export(
        model,
        dummy_input,
        "models/lstm_autoencoder.onnx",
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}},
        opset_version=12
    )
    print("LSTM exported to models/lstm_autoencoder.onnx")


def score_sequence(onnx_session, scaler, sequence_np):
    threshold = np.load("models/lstm_threshold.npy")
    seq_scaled = scaler.transform(sequence_np).astype(np.float32)
    seq_input = np.expand_dims(seq_scaled, axis=0)
    ort_inputs = {onnx_session.get_inputs()[0].name: seq_input}
    ort_outs = onnx_session.run(None, ort_inputs)
    reconstruction = ort_outs[0]
    mse = np.mean((reconstruction - seq_input) ** 2)
    return {
        "reconstruction_error": float(mse),
        "is_anomaly": bool(mse > threshold)
    }


# --- MODEL C: RIDGE REGRESSION ---
def train_what_if_model():
    print("\n--- Training Ridge Regression (What-If Model) ---")
    df = pd.read_csv("data/cnc_telemetry_2000.csv")
    features = ["vibration_rms", "spindle_load", "temperature_c", "tool_life_pct"]

    def calc_health(row):
        v = min(1, row["vibration_rms"] / 7.0)
        l = min(1, row["spindle_load"] / 100.0)
        t = min(1, (row["temperature_c"] - 40) / 60.0)
        w = 1 - (row["tool_life_pct"] / 100.0)
        score = 100 - (25 * v + 20 * l + 25 * t + 30 * w)
        return max(0, score)

    df["health_score"] = df.apply(calc_health, axis=1)
    df["anomaly_prob"] = df["fault_class"].apply(lambda x: 0.0 if x == "normal" else 1.0)
    df["rul_hours"] = df["tool_life_pct"] / 0.6

    X = df[features]
    y = df[["health_score", "rul_hours", "anomaly_prob"]]

    ridge = MultiOutputRegressor(Ridge(alpha=1.0))
    ridge.fit(X, y)

    joblib.dump(ridge, "models/what_if_model.pkl")
    print("Ridge Regression model saved to models/what_if_model.pkl")
    print(f"Sample prediction (healthy): {ridge.predict([[1.5, 60, 65, 90]])}")


if __name__ == "__main__":
    os.makedirs("models", exist_ok=True)
    train_isolation_forest()
    train_what_if_model()
    # LSTM is commented out — pre-train separately in Step 0G
    # train_lstm_autoencoder()
    # export_lstm_onnx()
    print("\n✅ Models A and C trained successfully.")
    print("Run Step 0G separately to train the LSTM.")