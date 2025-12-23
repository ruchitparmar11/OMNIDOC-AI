# code_explanation.md

This is a comprehensive breakdown of `main.py`, line by line and block by block. This file represents the core application logic for "OMNIDOC AI," a Streamlit-based web app that allows users to upload documents, analyze them using AI models (Grok or OpenRouter), and maintain a history of their sessions.

### **1. Imports and Setup (Lines 1–26)**
This section imports all necessary libraries and configures the environment.
*   **Libraries**:
    *   `streamlit`: The web framework used for the UI.
    *   `os`, `tempfile`, `platform`: For handling file system operations and detecting the OS (Windows vs. Linux).
    *   `openai`: The client used to communicate with AI models (even though it's used for Grok/OpenRouter, the interface is compatible).
    *   `sqlite3`: For the local database to store users and history.
    *   `utils.extract_*`: Custom helper modules imported to handle text extraction from PDF, Word, Images, and Code files.
    *   `fpdf`: For generating PDF reports of user history.
*   **Tesseract Configuration (Lines 18-25)**: Explicitly sets the path to the Tesseract OCR engine executable if running on Windows (`C:\Program Files\Tesseract-OCR\tesseract.exe`). This is required for extracting text from images.

### **2. API Initialization (Lines 28-90)**
This block sets up the AI client.
*   **Global Variables (Lines 30-33)**: Initializes `client`, `chosen_model`, and `fallback_models` to `None` or empty lists to prevent errors if initialization fails.
*   **Secret Keys (Lines 39-40)**: Attempts to retrieve API keys (`GROK_API_KEY` or `OPENROUTER_API_KEY`) from Streamlit's secrets management.
*   **Client Selection**:
    *   **Grok (Lines 42-53)**: If a Grok key is found, it connects to `api.x.ai` using the model `grok-2-1212`.
    *   **OpenRouter (Lines 54-74)**: If an OpenRouter key is found, it connects to `openrouter.ai`. It sets a default model (`gpt-4o-mini`) and a list of powerful fallback models (like Llama 3, Gemini Pro) to use if the first one fails.
*   **Sidebar Debug Info (Lines 80-84)**: Adds an expander in the sidebar showing which model is currently active.

### **3. Database Management (Lines 91-183)**
Handles all SQLite database operations.
*   **`init_db()`**: Creates two tables if they don't exist:
    *   `users`: Stores `username` and `password_hash`.
    *   `user_history`: Stores document analysis sessions. It attempts to add a `file_name` column (Lines 113-117) to handle schema migrations for older database versions.
*   **Authentication**:
    *   `hash_password()`: Secures passwords using SHA-256 hashing.
    *   `register_user()` & `login_user()`: handled creating new users and verifying credentials against the database.
*   **History Management**:
    *   `save_user_history()`: Saves a new analysis session.
    *   `get_user_history()`: Retrieves all past sessions for a specific user, ordered by newest first.
    *   `delete_user_history_entry()` & `update_history_filename()`: Functions to delete old sessions or rename them in the sidebar.

### **4. AI Helper Functions (Lines 185-317)**
Core logic for processing text and interacting with the AI.
*   **`generate_with_retry(prompt)`**:
    *   Attempts to send the user's prompt to the `chosen_model`.
    *   If it fails (error 429, 500, etc.), it iterates through `fallback_models` until one works or all fail.
*   **`generate_fallback_description`**:
    *   If *all* AI models are down, this function returns a hardcoded string based on file type (e.g., "This is a PDF document..."), ensuring the app doesn't crash completely.
*   **`split_text_recursive()`**:
    *   A utility that intelligently splits very long text strings into smaller chunks (attempting to break at paragraphs or sentences) to ensure they fit within the AI model's context window.
*   **`process_large_document()`**:
    *   **Logic**: If a document is small, it sends it directly. If large (>100k chars), it splits it into chunks.
    *   **Loop**: It iterates through chunks, generating a summary for each one (and showing a progress bar).
    *   **Synthesis**: Finally, it combines all chunk summaries and asks the AI to generate one final result from them.

### **5. UI Styling (Lines 318-453)**
This large block injects custom CSS into the app using `st.markdown(..., unsafe_allow_html=True)`.
*   It overrides Streamlit's default look to create a **dark theme** with a specific color palette:
    *   Backgrounds: Dark greens/blacks (`#0A0F0D`, `#2D4F4A`).
    *   Text: Light teal/white (`#CFE7E0`).
    *   Inputs/Buttons: Custom rounded borders, hover effects, and colors.
*   It specifically styles the "Auth Box" (Where users login) to look like a card with a shadow.

### **6. Authentication Flow (Lines 454-547)**
Determines if the user sees the App or the Login Screen.
*   **Session Check**: Checks if `user_id` is in `st.session_state`.
*   **Login Screen**: If not logged in, displays input fields for Username and Password.
    *   Validates credentials using `login_user`.
    *   If valid, sets session state and reruns the app to show the main interface.
*   **Registration**: A toggle button shows a registration form to create new users using `register_user`.

### **7. Main Application Interface (Lines 549-573)**
This code runs only *after* a user logs in.
*   **Header**: Displays a personalized "Welcome back, [Username]" message.
*   **Output Selector**: A radio button allowing the user to choose what they want:
    *   `Summary`: Brief overview.
    *   `Detailed`: Comprehensive explanation.
    *   `Bullet Points`: Key takeaways list.
    *   `Q&A`: Extracting questions from the text and answering them.

### **8. Sidebar & History (Lines 575-786)**
Everything inside the left sidebar.
*   **Logout**: A button that clears session state and reruns the app.
*   **History List**:
    *   Calls `get_user_history` to fetch data.
    *   **Download PDF**: Generates a PDF of the history using `fpdf` and offers it for download.
    *   **Search**: A text box to filter history items.
    *   **Item Display**: Loops through history items, displaying them in expandable sections (`st.expander`).
        *   Includes buttons to **Load** a previous session (restoring its data to the main view), **Delete** it, or **Edit** its name.
    *   **Bulk Delete**: Logic to select multiple items via checkboxes and delete them all at once.

### **9. File Upload & Processing (Lines 787-828)**
*   **Input**: Provides a `file_uploader` (accepting .txt, .pdf, .docx, images, code) and a `text_area` for direct pasting.
*   **Extraction Logic**:
    *   detects file extension.
    *   Saves the uploaded file to a temporary location.
    *   Calls the appropriate extraction tool (e.g., `extract_text_from_pdf` for .pdf).
    *   Reads the text content into the `content` variable.

### **10. Generation Logic (Lines 829-1008)**
The "Generate Description" button trigger.
*   **Prompt Engineering**: Based on the `output_type` selected earlier (Summary vs Detailed vs Q&A), it constructs a specific prompt template.
*   **Q&A Special Handling (Line 851+)**:
    *   If "Q&A" is selected, it uses a two-step process:
        1.  Ask AI to *find* all questions in the text.
        2.  Parse those questions and loop through them, asking the AI to answer each one individually based on the content.
*   **Execution**: Calls `process_large_document` with the content and prompt.
*   **Error Handling**: If the API is overloaded (e.g. 429 error), it catches the exception and uses `generate_fallback_description` to give a basic response instead of crashing.
*   **Saving**: Finally, saves the result to the database via `save_user_history`.

### **11. Q&A and Display (Lines 1009-1093)**
*   **Result Display**: Shows the generated description in a styled box.
*   **Follow-up Q&A**:
    *   Displays a "Ask a Question" input field below the results.
    *   If the user asks a question, it sends the *entire description* + the *question* back to the AI context to get an answer.
    *   It appends this new Q&A pair to the current session's history and updates the database, so the conversation is saved.
