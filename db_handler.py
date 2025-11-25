import os
import datetime
from pymongo import MongoClient

class DatabaseHandler:
    def __init__(self, uri):
        try:
            self.client = MongoClient(uri)
            self.db = self.client["arc_mainframe"]
            self.memory = self.db["long_term_memory"]
            self.alerts = self.db["alert_history"]
        except: self.client = None

    def learn_fact(self, fact):
        if not self.client: return "DB Error"
        doc = {"type": "fact", "content": fact, "date": str(datetime.datetime.now())}
        self.memory.insert_one(doc)
        return "Memory Synced."

    def get_facts(self):
        if not self.client: return ""
        facts = list(self.memory.find({"type": "fact"}))
        return "\n".join([f"- {f['content']}" for f in facts])

    def log_alert(self, message):
        if self.client:
            self.alerts.insert_one({"type": "alert", "content": message, "date": str(datetime.datetime.now())})

    def get_last_alert(self):
        if not self.client: return "None"
        last = self.alerts.find_one(sort=[("_id", -1)])
        return last["content"] if last else "None"
