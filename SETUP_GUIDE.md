# OMNIDOC Setup Guide

This guide explains two ways to run OMNIDOC on a different laptop:
1.  **Installation**: Setting up the full application on a new machine.
2.  **Local Network**: Accessing the application running on your current laptop from another device (laptop/phone) on the same WiFi.

---

## Option 1: Install on a New Laptop (Windows)

To run the application independently on a new laptop, follow these steps.

### 1. Pre-requisites
*   **Python**: Install Python (version 3.10 or higher recommended). [Download Here](https://www.python.org/downloads/)
    *   *Make sure to check "Add Python to PATH" during installation.*
*   **Tesseract OCR**: This is **required** for reading images/PDFs.
    *   Download the Windows installer (e.g., from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)).
    *   **CRITICAL**: You must install it to the default location: `C:\Program Files\Tesseract-OCR\`.
    *   *Why? The code in `main.py` explicitly looks for `tesseract.exe` in this folder.*

### 2. Copy the Project
Copy the entire `OMNIDOC` folder to the new laptop.
*   *Note: You can skip the `__pycache__` folders and `.git` folder if you want to save space.*

### 3. Install Dependencies
Open a Command Prompt (cmd) or PowerShell on the new laptop.
1.  Navigate to the project folder:
    ```powershell
    cd path\to\OMNIDOC
    ```
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
