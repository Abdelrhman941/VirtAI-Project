<<<<< Test_ASR
# 🎙️ Real-Time Arabic Speech-to-Text System (Faster-Whisper)

A high-performance, real-time Automatic Speech Recognition (ASR) system optimized for the **Arabic language** (Fusha & Dialects). 
Built using **Faster-Whisper** for transcription and **Silero VAD** for voice activity detection, ensuring high accuracy and low latency on CPU.

## 🚀 Features

- **Real-Time Streaming:** Transcribes audio directly from the microphone.
- **Arabic Optimization:** - Custom `initial_prompt` to guide the model for Technical/General Arabic.
  - configured to reduce hallucinations and repetition.
- **Smart VAD (Voice Activity Detection):** Uses Silero VAD to filter out silence and background noise before processing.
- **Modular Design:** Clean code structure separating Audio, VAD, and ASR logic.
- **Configurable:** All settings (Model size, Sensitivity, Latency) are managed via `configs/asr.yaml`.

---

## 📂 Project Structure

Ensure your project files are organized as follows:

```text
pro_final/
│
├── configs/
│   └── asr.yaml              # Configuration file (Model size, VAD threshold)
│
├── src/
│   ├── asr/
│   │   ├── __init__.py
│   │   ├── asr_handler.py    # Handles logic between Audio & Model
│   │   └── whisper_model.py  # The Core Whisper Class (Updated)
│   │
│   ├── audio/
│   │   ├── __init__.py
│   │   └── microphone.py     # Handles PyAudio streaming
│   │
│   ├── vad/
│   │   ├── __init__.py
│   │   └── simple_vad.py     # Silero VAD Wrapper
│   │
│   └── core/
│       ├── __init__.py
│       └── event_bus.py      # Event system (Optional)
│
├── run_live_asr.py           # 🏁 Main Entry Point
├── requirements.txt          # List of dependencies
└── README.md                 # This file

# 🛠️ Installation & Setup (Windows)

Follow these steps to set up the environment **from scratch** on Windows.

---

## 1️⃣ Create a Conda Environment

It is **highly recommended** to use **Python 3.10** for best compatibility.

```bash
conda create -n pro_win python=3.10 -y
conda activate pro_win
```

---

## 2️⃣ Install PyTorch

Install the CPU version of PyTorch:

```bash
pip install torch torchvision torchaudio
```

> 💡 If you have a CUDA-enabled GPU, install the appropriate PyTorch version from the official website.

---

## 3️⃣ Install Required Libraries

Run the following command to install all required dependencies:

```bash
pip install faster-whisper sounddevice numpy pyaudio pyyaml python-dotenv
```

---

# ⚙️ Configuration

## `configs/asr.yaml`

You can control **performance**, **latency**, and **accuracy** by editing the configuration file.

### ✅ Recommended Settings (CPU – High Accuracy)

```yaml
asr:
  model:
    # 'small' is recommended for Arabic on CPU
    # Use 'medium' only if you have a powerful machine
    model_size: "small"
    device: "cpu"
    
    # float32 = best accuracy on CPU
    # int8     = faster, slightly lower accuracy
    compute_type: "float32"

  vad:
    # Sensitivity: 0.1 (very sensitive) → 0.9 (less sensitive)
    threshold: 0.5

    # Ignore very short sounds (reduces breathing/noise detection)
    min_speech_duration_ms: 700

    # Required silence duration before processing (in ms)
    min_silence_duration_ms: 1000

  audio:
    sample_rate: 16000
    chunk_size: 512  # Smaller chunk = lower memory usage

  output:
    language: ar  # Force Arabic recognition
```

---

# ▶️ How to Run

### 1️⃣ Check Microphone

• Make sure your microphone is set as the **Default Input Device** in:

`Windows Settings → Sound → Input`

• Also check microphone permissions:

`Windows Settings → Privacy & Security → Microphone`

---

### 2️⃣ Activate the Environment

```bash
conda activate pro_win
```

---

### 3️⃣ Run Live ASR

```bash
python run_live_asr.py
```

---

# 🛑 How to Stop

Press **Ctrl + C** in the terminal to stop recording **gracefully**.

---

# 🔧 Troubleshooting

| Issue                                  | Possible Cause                                | Solution                                                             |
| -------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| No text appears                        | VAD threshold too high or mic muted           | Check Windows mic permissions. Lower `threshold` to `0.2`            |
| Hallucinations / weird text            | Model guessing context                        | Use `model_size: small`. Ensure `condition_on_previous_text = false` |
| `'str' object has no attribute 'text'` | Transcribe returns string instead of segments | Ensure `transcribe()` returns a **list of segments**, not plain text |
| Too sensitive (breathing/noise)        | Aggressive VAD settings                       | Increase `min_speech_duration_ms` to `700–1000`                      |

---

# 📜 License & Credits

This project uses:

• **faster-whisper**
• **Silero VAD**

Please refer to their respective licenses for usage terms.

---

✅ You can safely copy this entire section into your **README.md** file.
=======
# **VirtAI-Project**

## **Overview**
VirtAI - A smart AI-powered interactive system with ASR (Automatic Speech Recognition) and VAD (Voice Activity Detection) capabilities. Graduation Project.


## **Project Structure**

```

```

## **Requirements**

- **Python 3.9 or later** (recommended: 3.11)
- Install Python using **MiniConda**:

  1. Download and install MiniConda from [**here**](https://docs.anaconda.com/free/miniconda/#quick-command-line-install)

  2. Create a new environment:
     ```bash
     $ conda create -n project python=3.11 -y
     ```

  3. Activate the environment:
     ```bash
     $ conda activate project
     ```
> [!TIP]
> Setup your command line interface for better readability:
> ```bash
> $ export PS1="\[\033[01;32m\]\u@\h:\w\n\[\033[00m\]\$ "
> ```

---

## **Installation**

### **1. Install Required Packages**
- Install core dependencies:
    ```bash
    $ pip install -r requirements.txt
    ```

- **Install PyTorch with CUDA support** (if you have a compatible GPU):
    ```bash
    $ pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    ```

    > For CPU-only installation, use:
    > ```bash
    > $ pip install torch torchvision torchaudio
    > ```

### **2. Setup Environment Variables**

```bash
$ cp .env.example .env
```
>>>> main
