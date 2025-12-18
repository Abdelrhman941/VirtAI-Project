import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

class EventBus:
    """
    A simple synchronous Event Bus for decoupling components.
    Follows the Publish-Subscribe pattern.
    """
    def __init__(self):
        # Dictionary to hold subscribers: { "event_name": [callback_functions] }
        self.subscribers = defaultdict(list)

    def subscribe(self, event_type, callback):
        """
        Register a function (callback) to be called when event_type is published.
        """
        self.subscribers[event_type].append(callback)
        logger.debug(f"🔌 Subscribed to '{event_type}'")

    def publish(self, event_type, data=None):
        """
        Trigger an event and notify all subscribers.
        """
        if event_type in self.subscribers:
            for callback in self.subscribers[event_type]:
                try:
                    callback(data)
                except Exception as e:
                    logger.error(f"❌ Error in event handler for '{event_type}': {e}")
        else:
            # Useful for debugging if events are firing but no one is listening
            # logger.debug(f"⚠️ No subscribers for event: {event_type}")
            pass