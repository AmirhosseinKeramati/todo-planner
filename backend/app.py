from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, Task, backup_to_json, restore_from_json
import datetime
import os

def create_app():
    app = Flask(__name__)
    
    # Database configuration
    database_url = os.environ.get('DATABASE_URL', 'sqlite:///todos.db')
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Configure CORS to allow requests from any origin
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
    
    return app

app = create_app()

# API Routes
@app.route('/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.all()
    return jsonify([task.to_dict() for task in tasks])

@app.route('/tasks', methods=['POST'])
def create_task():
    try:
        data = request.json
        if not data or 'title' not in data:
            return jsonify({"error": "Title is required"}), 400
            
        new_task = Task(
            title=data['title'],
            description=data.get('description', ''),
            due_date=datetime.datetime.strptime(data['due_date'], '%Y-%m-%d').date() if data.get('due_date') else None,
            category=data.get('category', 'daily'),
            completed=False
        )
        db.session.add(new_task)
        db.session.commit()
        return jsonify(new_task.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating task: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.json
    
    for field in ['title', 'description', 'category', 'completed']:
        if field in data:
            setattr(task, field, data[field])
    
    if 'due_date' in data and data['due_date']:
        task.due_date = datetime.datetime.strptime(data['due_date'], '%Y-%m-%d').date()
    
    db.session.commit()
    return jsonify(task.to_dict())

@app.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return '', 204

@app.route('/backup', methods=['GET'])
def backup_data():
    tasks = Task.query.all()
    backup_to_json(tasks)
    return jsonify({"message": "Backup created successfully"}), 200

@app.route('/restore', methods=['POST'])
def restore_data():
    tasks_data = restore_from_json()
    
    # Clear existing data
    Task.query.delete()
    
    # Restore from backup
    for task_data in tasks_data:
        new_task = Task(
            title=task_data['title'],
            description=task_data.get('description', ''),
            due_date=datetime.datetime.strptime(task_data['due_date'], '%Y-%m-%d').date() if task_data.get('due_date') else None,
            category=task_data.get('category', 'daily'),
            completed=task_data.get('completed', False)
        )
        db.session.add(new_task)
    
    db.session.commit()
    return jsonify({"message": f"Restored {len(tasks_data)} tasks successfully"}), 200

if __name__ == '__main__':
    # Make Flask listen on all interfaces and explicitly set port
    app.run(debug=True, host='0.0.0.0', port=5000) 