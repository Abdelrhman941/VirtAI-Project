from loguru import logger  # type: ignore
import sys
from pathlib import Path
from typing import Optional

# ------------------------------------------------------------
# Logger Formats:
# ------------------------------
# Format for Console (Terminal)
CONSOLE_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
    "<level>{level: <10}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
    "<level>{message}</level>"
)

# Format for files (without colors)
FILE_FORMAT = (
    "{time:YYYY-MM-DD HH:mm:ss} | "
    "{level: <10} | "
    "{name}:{function}:{line} | "
    "{message}"
)

# ------------------------------------------------------------
# Main Setup Function:
# ------------------------------
def setup_logger(
    log_level: str = "INFO",
    log_dir: str = "logs",
    app_name: str = "avatar_chatbot",
    console_output: bool = True,
    file_output: bool = True,
    rotation: str = "500 MB",
    retention: str = "10 days",
    compression: str = "zip",
):
    """
    Set up the logging system

    Parameters:
    -----------
    log_level : str
        Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    log_dir : str
        Directory to save log files

    app_name : str
        Application name (used in file name)

    console_output : bool
        Should we print to Terminal?

    file_output : bool
        Should we save to files?

    rotation : str
        When to create a new file?
        Examples: "500 MB", "1 week", "1 day", "12:00"

    retention : str
        When to delete old files?
        Examples: "10 days", "1 month", "1 year"

    compression : str
        Compression type for old files
        "zip", "gz", "bz2" or None

    Returns:
    --------
    logger : Logger instance
    """

    # Remove default settings: loguru comes with default settings, we remove them to set our own
    logger.remove()

    # Add Console Handler:
    if console_output:
        logger.add(
            sys.stdout,  # Print to Terminal
            format=CONSOLE_FORMAT,  # Colored format
            level=log_level,  # Minimum level
            colorize=True,  # Enable colors
            backtrace=True,  # Show full traceback
            diagnose=True,  # Additional info for errors
        )

    # Add File Handler:
    if file_output:
        # Create logs directory if it doesn't exist
        log_path = Path(log_dir)
        log_path.mkdir(parents=True, exist_ok=True)

        # File path
        log_file = log_path / f"{app_name}_{{time:YYYY-MM-DD}}.log"

        logger.add(
            str(log_file),
            format=FILE_FORMAT,
            level=log_level,
            rotation=rotation,  # Create new file at 500MB
            retention=retention,  # Delete files older than 10 days
            compression=compression,  # Compress old files
            encoding="utf-8",  # Support Arabic
            backtrace=True,
            diagnose=True,
        )

    # ✅ Confirmation message:
    logger.info(f"- Logging system ready | Level: {log_level}")

    if file_output:
        logger.info(f"📁 Log files: {log_path.absolute()}")

    return logger

# ------------------------------------------------------------
# Additional Settings:
# ------------------------------
def set_log_level(level: str):
    """
    Change log level during runtime

    Example:
    --------
    >>> set_log_level("DEBUG")
    """
    logger.remove()
    setup_logger(log_level=level)
    logger.info(f"- Changed log level to: {level}")

def get_logger(name: Optional[str] = None):
    """
    Get a logger with specific name

    Parameters:
    -----------
    name : str
        Logger name (usually __name__)

    Returns:
    --------
    logger : Logger instance

    Example:
    --------
    >>> log = get_logger(__name__)
    >>> log.info("Message from specific module")
    """
    if name:
        return logger.bind(name=name)
    return logger

# ------------------------------------------------------------
# Context Manager for Temporary Logs:
# ------------------------------
class LogContext:
    """
    Context Manager for logging operation start and end

    Example:
    --------
    >>> with LogContext("Loading model"):
    ...     # Model loading code
    ...     pass
    # Output:
    # -> Started  : Loading model
    # -> Finished : Loading model (took 2.5 seconds)
    """

    def __init__(self, operation_name: str, log_level: str = "INFO"):
        self.operation_name = operation_name
        self.log_level = log_level
        self.start_time = None

    def __enter__(self):
        import time

        self.start_time = time.time()
        logger.log(self.log_level, f"-> Started : {self.operation_name}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        import time

        duration = time.time() - self.start_time

        if exc_type is None:
            logger.log(
                self.log_level,
                f"-> Finished : {self.operation_name} (took {duration:.2f} seconds)",
            )
        else:
            logger.error(
                f"❌ Failed: {self.operation_name} (after {duration:.2f} seconds)"
            )

        return False  # Don't suppress the exception

# ------------------------------------------------------------
#  Helper Function for Errors:
# ------------------------------
def log_exception(exception: Exception, context: str = ""):
    """
    Log an exception with all details

    Parameters:
    -----------
    exception : Exception
        The exception
    context : str
        Error context (optional)

    Example:
    --------
    >>> try:
    ...     1 / 0
    ... except Exception as e:
    ...     log_exception(e, "Division operation")
    """
    if context:
        logger.error(f"❌ Error in: {context}")

    logger.exception(exception)

if __name__ == "__main__":
    # Setup Logger
    setup_logger(log_level="DEBUG")
    print()
    print("------ Testing Log Levels ------")

    # Test all levels
    logger.debug("-> DEBUG message - fine details")
    logger.info("-> INFO message - general information")
    logger.success("-> SUCCESS message - operation successful")
    logger.warning("-> WARNING message - warning")
    logger.error("-> ERROR message - error")
    logger.critical("-> CRITICAL message - disaster!")

    print()
    print("------ Testing Context Manager ------")
    # Test LogContext
    with LogContext("Test operation"):
        import time

        time.sleep(1)  # Simulate operation

    print()
    print("------ Testing Error Logging ------")
    # Test errors
    try:
        result = 10 / 0
    except Exception as e:
        log_exception(e, "Division operation")

    print()
    print("✅ Test completed! Check 'logs' folder")
