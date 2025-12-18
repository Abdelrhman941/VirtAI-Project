# **VirtAI-Project**

## **Overview**
VirtAI - A smart AI-powered interactive system with ASR (Automatic Speech Recognition) and VAD (Voice Activity Detection) capabilities. Graduation Project.

<body>
    <div style = "
        width: 100%;
        border-radius: 100px;
        height: 20px;
        background: linear-gradient(to right,#B6AE9F,#C5C7BC,#DEDED1,#C5C7BC,#B6AE9F);">
    </div>
</body>

## **Project Structure**

```

```

<body>
    <div style = "
        width: 100%;
        border-radius: 100px;
        height: 20px;
        background: linear-gradient(to right,#B6AE9F,#C5C7BC,#DEDED1,#C5C7BC,#B6AE9F);">
    </div>
</body>

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

<body>
    <div style = "
        width: 100%;
        border-radius: 100px;
        height: 20px;
        background: linear-gradient(to right,#B6AE9F,#C5C7BC,#DEDED1,#C5C7BC,#B6AE9F);">
    </div>
</body>

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

<body>
    <div style = "
        width: 100%;
        border-radius: 100px;
        height: 20px;
        background: linear-gradient(to right,#B6AE9F,#C5C7BC,#DEDED1,#C5C7BC,#B6AE9F);">
    </div>
</body>

## **Configuration Files**
`chat_with_lam.yaml`: Configuration file for the chat system.
   - This file contains all project settings
   - You can modify it without changing the code!

`settings.py`: Python module to load and parse the YAML configuration file.
   - Loads settings from `chat_with_lam.yaml`
   - Provides easy-to-use properties for accessing settings
   - Integrates values from .env and YAML
   - Usage Example:
        ```python
        >>> from src.config import settings
        >>> print(settings.server_port)
        8282
        ```

<body>
    <div style = "
        width: 100%;
        border-radius: 100px;
        height: 20px;
        background: linear-gradient(to right,#B6AE9F,#C5C7BC,#DEDED1,#C5C7BC,#B6AE9F);">
    </div>
</body>

## **Testing**

- **Testing YAML Configuration:**
To ensure your YAML configuration file is valid and correctly set up, run the following test script:
```bash
$ python src/tests/test_yaml.py
```

- **Testing settings.py:**
To test the `settings.py` module and verify that settings are loaded correctly, run:
```bash
$ python src/config/settings.py
```
