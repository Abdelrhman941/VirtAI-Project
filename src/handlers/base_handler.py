import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from src.config import logger
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from enum import Enum

# ------------------------------------------------------------
# Handler Types:
# ------------------------------
class HandlerType(Enum):
    """
    Classification of Handler types

    Benefits:
    --------
    - Organize Handlers
    - Type validation
    - Easy filtering
    """

    ASR = "asr"         # Automatic Speech Recognition (speech → text)
    TTS = "tts"         # Text-to-Speech (text → speech)
    LLM = "llm"         # Large Language Model (understanding and response)
    VAD = "vad"         # Voice Activity Detection (speech detection)
    AVATAR = "avatar"   # Avatar Animation (avatar control)
    CLIENT = "client"   # Client/UI Handler

    def __str__(self):
        return self.value

# ------------------------------------------------------------
# Base Handler Class:
# ------------------------------
class BaseHandler(ABC):
    """
    Base class for all Handlers

    Core Functions:
    ---------------
    1. initialize() - Load models/resources
    2. process()    - Process data
    3. cleanup()    - Clean up resources

    Properties:
    -----------
    - config         : Handler settings from YAML
    - enabled        : Is Handler enabled?
    - module         : Module name
    - handler_type   : Handler type
    - is_initialized : Is initialized?

    Example:
    --------
    >>> class MyHandler(BaseHandler):
    ...     def __init__(self, config):
    ...         super().__init__(config, HandlerType.ASR)
    ...
    ...     async def initialize(self):
    ...         # Load model
    ...         pass
    ...
    ...     async def process(self, input_data):
    ...         # Process data
    ...         return result
    ...
    ...     async def cleanup(self):
    ...         # Cleanup
    ...         pass
    """

    def __init__(
        self,
        config: Dict[str, Any],
        handler_type: HandlerType,
        name: Optional[str] = None,
    ):
        """
        Constructor

        Parameters:
        -----------
        config : Dict
            Handler settings from YAML file

        handler_type : HandlerType
            Handler type (ASR, TTS, etc.)

        name : str, optional
            Custom name for Handler
        """
        self.config = config
        self.handler_type = handler_type
        self.name = name or self.__class__.__name__

        # Read basic settings
        self.enabled = config.get("enabled", True)
        self.module = config.get("module", "")

        # Initialization state
        self._is_initialized = False

        logger.debug(
            f"- Created {self.name} "
            f"(Type: {self.handler_type}, Status: {'Enabled' if self.enabled else 'Disabled'})"
        )

    # ------------------------------
    # Core Functions (must be implemented):
    # ------------------------------
    @abstractmethod
    async def initialize(self) -> None:
        """
        Initialize Handler (load models, connect to API, etc.)

        ⚠️ Must be implemented in every Handler!

        Raises:
        -------
        Exception : If initialization fails

        Example:
        --------
        >>> async def initialize(self):
        ...     logger.info("Loading model...")
        ...     self.model = load_model()
        ...     logger.success("Loaded!")
        """
        pass

    @abstractmethod
    async def process(self, input_data: Any) -> Any:
        """
        Process data (main function)

        ⚠️ Must be implemented in every Handler!

        Parameters:
        -----------
        input_data : Any
            Input data (audio, text, etc.)

        Returns:
        --------
        Any : Processed result

        Example:
        --------
        >>> async def process(self, audio_bytes):
        ...     text = self.model.transcribe(audio_bytes)
        ...     return text
        """
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """
        Clean up resources (close connections, delete models from memory)

        ⚠️ Must be implemented in every Handler!

        Example:
        --------
        >>> async def cleanup(self):
        ...     if self.model:
        ...         del self.model
        ...     logger.info("Cleaned up")
        """
        pass

    # ------------------------------
    # Helper Functions (ready to use):
    # ------------------------------
    def is_enabled(self) -> bool:
        """
        Check if Handler is enabled

        Returns:
        --------
        bool : True if enabled
        """
        return self.enabled

    def is_initialized(self) -> bool:
        """
        Check initialization state

        Returns:
        --------
        bool : True if initialized
        """
        return self._is_initialized

    async def safe_initialize(self) -> bool:
        """
        Safe initialization (with error handling)

        Returns:
        --------
        bool : True if initialization succeeded

        Example:
        --------
        >>> success = await handler.safe_initialize()
        >>> if success:
        ...     print("Ready!")
        """
        if not self.enabled:
            logger.warning(f"⚠️  {self.name} is disabled, skipping initialization")
            return False

        if self._is_initialized:
            logger.warning(f"⚠️  {self.name} already initialized")
            return True

        try:
            logger.info(f"-> Initializing {self.name}...")
            await self.initialize()
            self._is_initialized = True
            logger.success(f"✅ {self.name} ready!")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize {self.name}: {e}")
            logger.exception(e)
            return False

    async def safe_process(self, input_data: Any) -> Optional[Any]:
        """
        Safe processing (with error handling)

        Parameters:
        -----------
        input_data : Any
            Input data

        Returns:
        --------
        Any | None : Result or None if failed
        """
        if not self.enabled:
            logger.warning(f"⚠️  {self.name} is disabled")
            return None

        if not self._is_initialized:
            logger.error(f"❌ {self.name} not initialized!")
            return None

        try:
            logger.debug(f"🔄 {self.name} processing data...")
            result = await self.process(input_data)
            logger.debug(f"✅ {self.name} finished processing")
            return result

        except Exception as e:
            logger.error(f"❌ Error in {self.name}: {e}")
            logger.exception(e)
            return None

    async def safe_cleanup(self) -> None:
        """
        Safe cleanup (with error handling)
        """
        try:
            logger.info(f"- Cleaning up {self.name}...")
            await self.cleanup()
            self._is_initialized = False
            logger.success(f"✅ Cleaned up {self.name}")

        except Exception as e:
            logger.error(f"❌ Error cleaning up {self.name}: {e}")
            logger.exception(e)

    # ------------------------------
    # Utility Methods:
    # ------------------------------
    def get_config_value(self, key: str, default: Any = None) -> Any:
        """
        Get value from settings

        Parameters:
        -----------
        key : str
            Key name
        default : Any
            Default value

        Returns:
        --------
        Any : The value

        Example:
        --------
        >>> model_name = self.get_config_value('model_name', 'default-model')
        """
        return self.config.get(key, default)

    def __repr__(self) -> str:
        """Text representation of object"""
        status = "✅" if self.enabled else "❌"
        init_status = "🟢" if self._is_initialized else "🔴"
        return (
            f"<{self.name} "
            f"type={self.handler_type} "
            f"enabled={status} "
            f"initialized={init_status}>"
        )

    def __str__(self) -> str:
        """Simple text"""
        return f"{self.name} ({self.handler_type})"

# ------------------------------------------------------------
# Example for Testing:
# ------------------------------
class DummyHandler(BaseHandler):
    """
    Example Handler for demonstration
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config, HandlerType.ASR, name="DummyHandler")
        self.counter = 0

    async def initialize(self):
        """Simulate model loading"""
        import asyncio

        logger.info("⏳ Loading dummy model...")
        await asyncio.sleep(1)  # Simulate loading
        logger.info("✅ Loaded!")

    async def process(self, input_data: Any) -> str:
        """Simulate processing"""
        self.counter += 1
        result = f"Processing #{self.counter}: {input_data}"
        return result

    async def cleanup(self):
        """Cleanup"""
        logger.info(f"Processed {self.counter} requests")
        self.counter = 0

if __name__ == "__main__":
    import asyncio
    async def test_base_handler():
        """Test BaseHandler"""
        print()
        print("------ Testing Base Handler ------")

        # Create test Handler
        config = {"enabled": True, "module": "dummy", "test_key": "test_value"}

        handler = DummyHandler(config)

        # Test properties
        logger.info(f"Handler     : {handler}")
        logger.info(f"Enabled     ? {handler.is_enabled()}")
        logger.info(f"Initialized ? {handler.is_initialized()}")

        # Test initialization
        success = await handler.safe_initialize()
        logger.info(f"Initialization succeeded? {success}")

        # Test processing
        result1 = await handler.safe_process("Test data 1")
        logger.info(f"Result 1: {result1}")

        result2 = await handler.safe_process("Test data 2")
        logger.info(f"Result 2: {result2}")

        # Test cleanup
        await handler.safe_cleanup()

        # Test get_config_value
        test_value = handler.get_config_value("test_key")
        logger.info(f"Config value: {test_value}")

        logger.success("✅ Test completed!")
    # Run test
    asyncio.run(test_base_handler())
