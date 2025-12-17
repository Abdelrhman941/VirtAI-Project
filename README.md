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
