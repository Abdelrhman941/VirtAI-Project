import yaml                 # type: ignore
from pathlib import Path

config_path = Path("src/config/chat_with_lam.yaml")
print("------ YAML Configuration Test ------")
print(f"- Looking for config file at: {config_path.absolute()}")

# Try to read the file
try:
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    print("✅ YAML file is valid!")
    print("- Configuration content:")
    print(f"Port       : {config['default']['service']['port']}")
    print(f"Log Level  : {config['default']['logger']['log_level']}")
    print(f"Model Root : {config['default']['chat_engine']['model_root']}")

    # Show handler configurations
    print("\n- Handler Configurations:")
    handlers = config["default"]["chat_engine"]["handler_configs"]
    for handler_name in handlers.keys():
        print(f"  - {handler_name}")

    print("\n✅ All configurations loaded successfully!")

except FileNotFoundError:
    print(f"❌ File not found!")
    print(f"Current working directory: {Path.cwd()}")
    print(f"Please run from project root directory")
except yaml.YAMLError as e:
    print(f"❌ Error in YAML file:\n{e}")
except KeyError as e:
    print(f"❌ Missing key in configuration: {e}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
