const USE_STATIC_DATA = true; // Set to false when backend is available

// Static data for testing
const STATIC_TASKS = [
    {
        id: 1,
        title: "Complete project proposal",
        description: "Write up the project proposal for the client meeting",
        due_date: "2023-12-15",
        category: "weekly",
        completed: false,
        created_at: "2023-12-01 10:00:00"
    },
    {
        id: 2,
        title: "Buy groceries",
        description: "Milk, eggs, bread, fruits",
        due_date: "2023-12-10",
        category: "daily",
        completed: true,
        created_at: "2023-12-01 11:30:00"
    },
    {
        id: 3,
        title: "Pay rent",
        description: "Transfer money to landlord",
        due_date: "2023-12-30",
        category: "monthly",
        completed: false,
        created_at: "2023-12-01 12:00:00"
    }
];

// Dark mode functionality
function setupDarkMode() {
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    // Check for saved theme preference or use preferred color scheme
    const savedTheme = localStorage.getItem('theme') || 
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    // Apply the saved theme
    applyTheme(savedTheme);
    
    // Theme toggle event listener
    themeToggle.addEventListener('click', function() {
        const currentTheme = htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Apply theme with consistent transition
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });
    
    function applyTheme(theme) {
        // Set the theme attribute which triggers CSS transitions
        htmlElement.setAttribute('data-theme', theme);
    }
}

// Enhance form elements
function enhanceFormElements() {
    const datePicker = document.getElementById('task-due-date');
    const categorySelect = document.getElementById('task-category');
    
    // Enhance date picker
    if (datePicker) {
        // Set default value to today if not already set
        if (!datePicker.value) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            datePicker.value = `${year}-${month}-${day}`;
        }
    }
    
    // Ensure proper styling for select element
    if (categorySelect) {
        // Remove any default browser styling
        categorySelect.classList.add('neumorph-select');
    }
    
    // Apply neumorphic styling to all form elements
    document.querySelectorAll('input, select, textarea').forEach(el => {
        el.addEventListener('focus', function() {
            this.classList.add('focused');
        });
        
        el.addEventListener('blur', function() {
            this.classList.remove('focused');
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dark mode
    setupDarkMode();
    
    // Configurable API URL with fallback options
    const API_URLS = [
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        // Add more fallback URLs if needed
    ];
    
    let currentApiUrlIndex = 0;
    let API_URL = API_URLS[currentApiUrlIndex];
    
    // Function to try different API URLs
    async function tryNextApiUrl() {
        currentApiUrlIndex = (currentApiUrlIndex + 1) % API_URLS.length;
        API_URL = API_URLS[currentApiUrlIndex];
        console.log(`Trying next API URL: ${API_URL}`);
        
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                signal: AbortSignal.timeout(3000)
            });
            return response.ok;
        } catch (error) {
            console.error(`Failed to connect to ${API_URL}:`, error);
            return false;
        }
    }
    
    // DOM Elements
    const taskForm = document.getElementById('task-form');
    const tasksList = document.getElementById('tasks-list');
    const taskTemplate = document.getElementById('task-template');
    const categoryFilters = document.querySelectorAll('.category-filter');
    const currentFilterDisplay = document.getElementById('current-filter');
    
    // State
    let currentFilter = 'all';
    let tasks = [];
    let isOfflineMode = false;
    
    // Local storage backup
    function saveToLocalStorage() {
        localStorage.setItem('todo_tasks', JSON.stringify(tasks));
    }
    
    function loadFromLocalStorage() {
        try {
            return JSON.parse(localStorage.getItem('todo_tasks') || '[]');
        } catch (e) {
            console.error('Error loading from localStorage:', e);
            return [];
        }
    }
    
    // API Service with better error handling
    const TaskService = {
        async fetchAll() {
            let attempts = 0;
            const maxAttempts = API_URLS.length * 2; // Try each URL twice
            
            while (attempts < maxAttempts) {
                try {
                    console.log(`Fetching tasks from: ${API_URL}/tasks`);
                    const response = await fetch(`${API_URL}/tasks`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        // Add timeout to prevent hanging
                        signal: AbortSignal.timeout(5000)
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    isOfflineMode = false;
                    updateConnectionStatus('online');
                    return data;
                } catch (error) {
                    console.error('Error fetching tasks:', error);
                    isOfflineMode = true;
                    updateConnectionStatus('offline');
                    // Return local data as fallback
                    return loadFromLocalStorage();
                }
            }
        },
        
        async create(taskData) {
            if (isOfflineMode) {
                // Create task locally when offline
                const newTask = {
                    id: Date.now(), // Use timestamp as ID in offline mode
                    ...taskData,
                    created_at: new Date().toISOString(),
                    _offline: true // Mark as created offline
                };
                
                const localTasks = loadFromLocalStorage();
                localTasks.push(newTask);
                localStorage.setItem('todo_tasks', JSON.stringify(localTasks));
                
                return newTask;
            }
            
            try {
                const response = await fetch(`${API_URL}/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(taskData),
                    signal: AbortSignal.timeout(5000)
                });
                
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                
                const newTask = await response.json();
                saveToLocalStorage(); // Backup to local storage
                return newTask;
            } catch (error) {
                console.error('Error creating task:', error);
                // Switch to offline mode and retry
                isOfflineMode = true;
                updateConnectionStatus('offline');
                return this.create(taskData);
            }
        },
        
        async update(taskId, taskData) {
            const response = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            return await response.json();
        },
        
        async delete(taskId) {
            await fetch(`${API_URL}/tasks/${taskId}`, { method: 'DELETE' });
            return true;
        }
    };
    
    // Update connection status in UI with improved styling
    function updateConnectionStatus(status) {
        let statusElement = document.getElementById('connection-status');
        
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'connection-status';
            statusElement.className = 'connection-status';
            const container = document.querySelector('.container');
            const heading = container.querySelector('h1');
            container.insertBefore(statusElement, heading.nextSibling);
        }
        
        if (status === 'online') {
            statusElement.className = 'connection-status online';
            statusElement.innerHTML = `
                <span class="connection-status-icon online"></span>
                Connected to server
            `;
        } else {
            statusElement.className = 'connection-status offline';
            statusElement.innerHTML = `
                <span class="connection-status-icon offline"></span>
                Offline Mode (Data stored locally)
                <button id="retry-connection" class="neumorph-btn py-1 px-3 text-sm ml-2 rounded-lg">
                    Retry
                </button>
            `;
            
            // Add event listener to retry button
            document.getElementById('retry-connection')?.addEventListener('click', async function() {
                this.textContent = 'Connecting...';
                this.disabled = true;
                
                try {
                    const response = await fetch(`${API_URL}/tasks`, {
                        signal: AbortSignal.timeout(3000)
                    });
                    
                    if (response.ok) {
                        isOfflineMode = false;
                        updateConnectionStatus('online');
                        
                        // Refresh tasks from server
                        const serverTasks = await response.json();
                        tasks = serverTasks;
                        renderTasks();
                    } else {
                        throw new Error(`Server returned ${response.status}`);
                    }
                } catch (error) {
                    console.error('Connection retry failed:', error);
                    this.textContent = 'Retry';
                    this.disabled = false;
                }
            });
        }
    }
    
    // Render tasks function
    function renderTasks() {
        tasksList.innerHTML = '';
        
        const filteredTasks = currentFilter === 'all' 
            ? tasks 
            : tasks.filter(task => task.category === currentFilter);
        
        if (filteredTasks.length === 0) {
            tasksList.innerHTML = '<div class="text-center text-gray-500 py-4">No tasks found.</div>';
            return;
        }
        
        filteredTasks.forEach(task => {
            const taskElement = createTaskElement(task);
            tasksList.appendChild(taskElement);
        });
        
        // Save to local storage after rendering
        saveToLocalStorage();
    }
    
    // Create task element function
    function createTaskElement(task) {
        const taskElement = document.importNode(taskTemplate.content, true).querySelector('.task-item');
        
        taskElement.dataset.id = task.id;
        if (task.completed) {
            taskElement.classList.add('completed');
            taskElement.querySelector('.task-checkbox').classList.add('checked');
        }
        
        // Remove the yellow bar styling for offline tasks
        if (task._offline) {
            taskElement.classList.add('offline-task');
            // No border styling added here
        }
        
        taskElement.querySelector('.task-title').textContent = task.title;
        taskElement.querySelector('.task-description').textContent = task.description || '';
        
        const categoryElement = taskElement.querySelector('.task-category');
        categoryElement.textContent = task.category.charAt(0).toUpperCase() + task.category.slice(1);
        categoryElement.dataset.category = task.category;
        
        const dueDateElement = taskElement.querySelector('.task-due-date');
        if (task.due_date) {
            dueDateElement.textContent = `Due: ${formatDate(task.due_date)}`;
        } else {
            dueDateElement.textContent = 'No due date';
        }
        
        // Event listeners
        taskElement.querySelector('.task-checkbox').addEventListener('click', () => {
            toggleTaskCompletion(task.id, !task.completed);
        });
        
        taskElement.querySelector('.delete-task').addEventListener('click', () => {
            deleteTask(task.id);
        });
        
        return taskElement;
    }
    
    // Format date function
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
    
    // Toggle task completion
    function toggleTaskCompletion(taskId, completed) {
        if (isOfflineMode) {
            // Handle offline
            tasks = tasks.map(task => 
                task.id === taskId ? {...task, completed: completed} : task
            );
            renderTasks();
            return;
        }
        
        TaskService.update(taskId, { completed })
            .then(updatedTask => {
                tasks = tasks.map(task => 
                    task.id === updatedTask.id ? updatedTask : task
                );
                renderTasks();
            })
            .catch(error => {
                console.error('Error updating task:', error);
                // Fall back to offline mode
                isOfflineMode = true;
                updateConnectionStatus('offline');
                toggleTaskCompletion(taskId, completed);
            });
    }
    
    // Delete task
    function deleteTask(taskId) {
        if (isOfflineMode) {
            // Handle offline
            tasks = tasks.filter(task => task.id !== taskId);
            renderTasks();
            return;
        }
        
        TaskService.delete(taskId)
            .then(() => {
                tasks = tasks.filter(task => task.id !== taskId);
                renderTasks();
            })
            .catch(error => {
                console.error('Error deleting task:', error);
                // Fall back to offline mode
                isOfflineMode = true;
                updateConnectionStatus('offline');
                deleteTask(taskId);
            });
    }
    
    // Form submission handler
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            due_date: document.getElementById('task-due-date').value || null,
            category: document.getElementById('task-category').value
        };
        
        if (!taskData.title.trim()) {
            alert('Please enter a task title');
            return;
        }
        
        const submitButton = taskForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Adding...';
        submitButton.disabled = true;
        
        TaskService.create(taskData)
            .then(newTask => {
                console.log('Task created:', newTask);
                tasks.push(newTask);
                renderTasks();
                taskForm.reset();
            })
            .catch(error => {
                console.error('Error creating task:', error);
                alert('Failed to create task. Please try again.');
            })
            .finally(() => {
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            });
    }
    
    // Set up event listeners
    taskForm.addEventListener('submit', handleFormSubmit);
    
    // Category filter buttons
    categoryFilters.forEach(button => {
        button.addEventListener('click', function() {
            categoryFilters.forEach(btn => btn.classList.remove('neumorph-btn-active'));
            this.classList.add('neumorph-btn-active');
            
            currentFilter = this.dataset.category;
            currentFilterDisplay.textContent = currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1);
            
            renderTasks();
        });
    });
    
    // Initial load with better error handling
    console.log('Starting initial data load...');
    TaskService.fetchAll()
        .then(data => {
            console.log('Fetched tasks:', data);
            tasks = data;
            renderTasks();
        })
        .catch(error => {
            console.error('Error in initial data load:', error);
            // Already handled in fetchAll, but just in case
            isOfflineMode = true;
            updateConnectionStatus('offline');
            tasks = loadFromLocalStorage();
            renderTasks();
        });
}); 