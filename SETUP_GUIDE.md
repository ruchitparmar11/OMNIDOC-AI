# OMNIDOC Setup Guide

This guide explains two ways to run OMNIDOC on a different laptop:
1.  **Installation**: Setting up the full application on a new machine.
2.  **Local Network**: Accessing the application running on your current laptop from another device (laptop/phone) on the same WiFi.

---

## Option 1: Install on a New Laptop (Windows)

To run the application independently on a new laptop, follow these steps.

### 1. Pre-requisites
*   **Git**: Required to clone the repository. [Download Here](https://git-scm.com/downloads)
*   **Python**: Install Python (version 3.10 or higher recommended). [Download Here](https://www.python.org/downloads/)
    *   *Make sure to check "Add Python to PATH" during installation.*
*   **VS Code (Optional)**: Recommended code editor. [Download Here](https://code.visualstudio.com/)
*   **Tesseract OCR**: This is **required** for reading images/PDFs.
    *   Download the Windows installer (e.g., from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)).
    *   **CRITICAL**: You must install it to the default location: `C:\Program Files\Tesseract-OCR\`.
    *   *Why? The code in `main.py` explicitly looks for `tesseract.exe` in this folder.*

### 2. Get the Code (Clone from GitHub)
1.  Open a terminal (Command Prompt or PowerShell).
2.  Navigate to where you want to save the project:
    ```powershell
    cd Documents
    ```
3.  Clone the repository:
    ```powershell
    git clone <YOUR_GITHUB_REPO_URL>
    ```
    *(Replace `<YOUR_GITHUB_REPO_URL>` with the actual link found on your GitHub repo page under the green "Code" button)*
4.  Enter the project folder:
    ```powershell
    cd OMNIDOC
    ```

### 3. Install Dependencies
Open a Command Prompt (cmd) or PowerShell (if not already open).
1.  Ensure you are inside the `OMNIDOC` folder.

2.  Install the required Python libraries:
    ```powershell
    pip install -r requirements.txt
    ```

### 4. Configure API Keys
You need to set up your API keys on the new machine.
1.  Navigate to the `.streamlit` folder inside `OMNIDOC`.
2.  Create a file named `secrets.toml` (if it didn't copy over).
3.  Add your API key inside:
    ```toml
    OPENROUTER_API_KEY = "sk-or-your-key-here"
    ```

### 5. Run the App
Run the following command in the terminal inside the `OMNIDOC` folder:
```powershell
streamlit run main.py
```
The app should open in your browser automatically.

---

## Option 2: Access via Local Network (Same WiFi)

If you just want to *use* the app on another laptop without installing anything, serve it from your current laptop.

1.  **Connect both laptops** to the same WiFi network.
2.  On your **current laptop** (where the code is), run:
    ```powershell
    streamlit run main.py --server.address 0.0.0.0
    ```
3.  Look at the output in the terminal. It will show a **Network URL**, for example:
    ```
    Network URL: http://192.168.1.5:8501
    ```
    *Note: If you don't see a Network URL, find your IP address by running `ipconfig` in a new terminal and looking for "IPv4 Address".*
4.  On the **other laptop**, open a browser and type that Network URL (e.g., `http://192.168.1.5:8501`).

*Troubleshooting*: If it doesn't load, check your **Windows Firewall** settings on the host laptop and ensure Python is allowed to accept incoming connections.
