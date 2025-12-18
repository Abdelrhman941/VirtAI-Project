import yaml                 # type: ignore
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import os

load_dotenv()   # Load environment variables from .env file

class Settings:
    def __init__(self, config_path: str = "src/config/chat_with_lam.yaml"):
        """
        Constructor

        Parameters:
        -----------
        config_path : str
            Path to YAML file (default: configs/chat_with_lam.yaml)
        """
        self.config_path = Path(config_path)
        self.config      = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """
        Private function to load YAML file

        Returns:
        --------
        Dict : File content as Dictionary

        Raises:
        -------
        FileNotFoundError : If file doesn't exist
        yaml.YAMLError    : If file has errors
        """
        # Check if file exists
        if not self.config_path.exists():
            raise FileNotFoundError(f"❌ Settings file not found: {self.config_path}")

        # Read file
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
                print('-'*50)
                print(f"✅ Loaded settings from: {self.config_path}")
                return config
        except yaml.YAMLError as e:
            raise ValueError(f"❌ Error reading YAML file: {e}")

    # ------------------------------------------------------------
    # Logger Settings:
    # ------------------------------
    @property           # to make it accessible as attribute not function
    def log_level(self) -> str:
        """
        Get log level

        Returns:
        --------
        str : Log level (INFO, DEBUG, etc.)
        """
        return self.config["default"]["logger"]["log_level"]

    # ------------------------------------------------------------
    # Server Settings:
    # ------------------------------
    @property
    def server_config(self) -> Dict[str, Any]:
        """
        Get all server settings

        Returns:
        --------
        Dict : {host, port, cert_file, cert_key}
        """
        return self.config["default"]["service"]

    @property
    def server_host(self) -> str:
        """Server host address"""
        return self.server_config["host"]

    @property
    def server_port(self) -> int:
        """Server port"""
        return self.server_config["port"]

    # ------------------------------------------------------------
    # Chat Engine Settings:
    # ------------------------------
    @property
    def chat_engine_config(self) -> Dict[str, Any]:
        """Chat engine settings"""
        return self.config["default"]["chat_engine"]

    @property
    def model_root(self) -> str:
        """Models folder path"""
        return self.chat_engine_config["model_root"]

    @property
    def concurrent_limit(self) -> int:
        """Number of simultaneous conversations"""
        return self.chat_engine_config["concurrent_limit"]

    @property
    def handler_search_path(self) -> list:
        """Handler search paths"""
        return self.chat_engine_config["handler_search_path"]

    # ------------------------------------------------------------
    # Handler Configurations:
    # ------------------------------
    def get_handler_config(self, handler_name: str) -> Dict[str, Any]:
        """
        Get configuration for a specific handler

        Parameters:
        -----------
        handler_name : str
            Handler name (e.g., "SenseVoice", "LLMOpenAICompatible")

        Returns:
        --------
        Dict : Handler settings

        Example:
        --------
        >>> asr_config = settings.get_handler_config("SenseVoice")
        >>> print(asr_config['model_name'])
        'iic/SenseVoiceSmall'
        """
        handlers = self.chat_engine_config.get("handler_configs", {})

        if handler_name not in handlers:
            raise KeyError(f"❌ Handler not found: {handler_name}")

        return handlers[handler_name]

    def is_handler_enabled(self, handler_name: str) -> bool:
        """
        Check if handler is enabled

        Parameters:
        -----------
        handler_name : str
            Handler name

        Returns:
        --------
        bool : True if enabled
        """
        try:
            config = self.get_handler_config(handler_name)
            return config.get("enabled", True)  # Enabled by default
        except KeyError:
            return False

    # ------------------------------------------------------------
    # API Keys (from .env):
    # ------------------------------
    @property
    def dashscope_api_key(self) -> Optional[str]:
        """DashScope API key"""
        return os.getenv("DASHSCOPE_API_KEY")

    @property
    def openai_api_key(self) -> Optional[str]:
        """OpenAI API key"""
        return os.getenv("OPENAI_API_KEY")

    # ------------------------------------------------------------
    # Utility Methods
    # ------------------------------
    def reload(self):
        """Reload settings from file"""
        self.config = self._load_config()
        print("Settings reloaded")

    def __repr__(self) -> str:
        """Text representation of the object"""
        return f"<Settings config_path='{self.config_path}'>"

# We use the same instance throughout the project, That's why we create it here once
settings = Settings()

if __name__ == "__main__":
    print("------ Testing Settings------")
    print("- Server Settings:")
    print(f"  Host     : {settings.server_host}")
    print(f"  Port     : {settings.server_port}")

    print("-" * 50)
    print("- Chat Engine Settings:")
    print(f"  Model Root       : {settings.model_root}")
    print(f"  Concurrent Limit : {settings.concurrent_limit}")

    print("-" * 50)
    print("- Handlers:")
    handlers = ["SenseVoice", "CosyVoice", "LLMOpenAICompatible"]
    for handler in handlers:
        enabled = "✅" if settings.is_handler_enabled(handler) else "❌"
        print(f"  {enabled} {handler}")

    print("-" * 50)
    print("- API Keys:")
    print(f"  DashScope : {'✅ Available' if settings.dashscope_api_key else '❌ Not available'}")
    print(f"  OpenAI    : {'✅ Available' if settings.openai_api_key else '❌ Not available'}")
