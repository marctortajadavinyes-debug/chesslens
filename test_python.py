import sys
try:
    import openai
    import chess
    import psycopg2
    print("Python environment check: SUCCESS")
except ImportError as e:
    print(f"Python environment check: FAILED - {e}")
    sys.exit(1)
