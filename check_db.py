import sqlite3
conn = sqlite3.connect('users.db')
c = conn.cursor()
c.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
for row in c.fetchall():
    print(f"--- TABLE {row[0]} ---")
    print(row[1])
    print()
