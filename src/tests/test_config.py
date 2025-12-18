import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from src import settings, logger, LogContext

def test_settings():
    """Test Settings"""
    print("------ Testing Settings ------")

    logger.info("- Server Settings:")
    logger.info(f"  - Host: {settings.server_host}")
    logger.info(f"  - Port: {settings.server_port}")

    logger.info("\n- Chat Engine Settings:")
    logger.info(f"  - Model Root       : {settings.model_root}")
    logger.info(f"  - Concurrent Limit : {settings.concurrent_limit}")

    logger.info("\n- Handler Status:")
    handlers = ["SenseVoice", "CosyVoice", "LLMOpenAICompatible"]
    for handler in handlers:
        enabled = settings.is_handler_enabled(handler)
        status = "✅ Enabled" if enabled else "❌ Disabled"
        logger.info(f"  - {handler}: {status}")

def test_logger_levels():
    """Test Logger Levels"""
    print()
    print("------ Testing Log Levels ------")

    logger.debug("-> DEBUG: Details for developers")
    logger.info("-> INFO: General information")
    logger.success("-> SUCCESS: Operation succeeded")
    logger.warning("-> WARNING: Watch out!")
    logger.error("-> ERROR: An error occurred")

def test_context_manager():
    """Test LogContext"""
    print()
    print("------ Testing Context Manager ------")

    import time

    with LogContext("Successful operation"):
        time.sleep(0.5)
        logger.info("  Working...")

    try:
        with LogContext("Failed operation"):
            time.sleep(0.3)
            raise ValueError("Intentional error!")
    except ValueError:
        pass

def test_exception_logging():
    """Test Exception Logging"""
    print()
    print("------ Testing Exception Logging ------")

    from src.config.logger import log_exception

    try:
        # Try to open non-existent file
        with open("nonexistent.txt", "r") as f:
            content = f.read()
    except Exception as e:
        log_exception(e, "Opening file")

def test_handler_config():
    """Test Getting Handler Settings"""
    print()
    print("------ Testing Handler Settings ------")

    try:
        asr_config = settings.get_handler_config("SenseVoice")
        logger.info(f"=> SenseVoice Config:")
        logger.info(f"  - Module  : {asr_config.get('module')}")
        logger.info(f"  - Model   : {asr_config.get('model_name')}")
        logger.info(f"  - Enabled : {asr_config.get('enabled')}")
    except KeyError as e:
        logger.error(f"Handler not found: {e}")

if __name__ == "__main__":
    logger.info("=> Starting comprehensive tests...\n")

    test_settings()
    test_logger_levels()
    test_context_manager()
    test_exception_logging()
    test_handler_config()

    print()
    logger.success("✅ All tests completed!")
    logger.info("📁 Check 'logs' folder for log files")
