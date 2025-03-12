from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    category = db.Column(db.String(20), default='daily')  # 'daily', 'weekly', 'monthly'
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'due_date': self.due_date.strftime('%Y-%m-%d') if self.due_date else None,
            'category': self.category,
            'completed': self.completed,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }

# Add a backup mechanism to JSON
def backup_to_json(tasks,

# ... rest of the file remains unchanged ...

# ... rest of the file remains unchanged ... 