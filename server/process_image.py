import os
import sys
import json
import psycopg2
import chess
import chess.pgn
from openai import OpenAI
import requests
import base64
from io import BytesIO

# Initialize OpenAI client
client = OpenAI(
    api_key=os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
    base_url=os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
)

def get_db_connection():
    return psycopg2.connect(os.environ.get("DATABASE_URL"))

def process_image(game_id, image_url):
    print(f"Processing game {game_id} with image {image_url[:50]}...")
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Prepare image for OpenAI
        # If it's a data URI, we pass it directly. If it's a URL, we might need to download or pass as URL.
        # OpenAI supports URLs and Base64.
        
        # Construct the message
        messages = [
            {
                "role": "system",
                "content": "You are a chess expert and data entry specialist. Your task is to transcribe chess moves from a handwritten scoresheet image into a list of algebraic notation moves."
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract the chess moves from this scoresheet. Return ONLY a JSON object with a single key 'moves' containing a list of strings. Each string should be a move in standard algebraic notation (e.g., 'e4', 'e5', 'Nf3'). Maintain the order: White 1, Black 1, White 2, Black 2, etc. Do not include move numbers in the strings. If a move is unclear, try your best to infer from context or output '??'."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url,
                        },
                    },
                ],
            }
        ]

        response = client.chat.completions.create(
            model="gpt-5.2",
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=4096
        )

        content = response.choices[0].message.content
        print(f"OpenAI response: {content}")
        
        data = json.loads(content)
        moves = data.get("moves", [])
        
        # Validate and build PGN
        game = chess.pgn.Game()
        node = game
        board = chess.Board()
        
        valid_moves = []
        
        for move_str in moves:
            try:
                # Sanitize move string (remove ? or !)
                clean_move = move_str.replace('?', '').replace('!', '').replace('+', '').replace('#', '')
                
                # Try to parse
                # We iterate legal moves to find a match if exact match fails (simple fuzzy logic could go here)
                # For now, rely on python-chess parsing
                move = board.push_san(move_str)
                node = node.add_variation(move)
                valid_moves.append(move_str)
            except ValueError:
                print(f"Illegal or unparseable move: {move_str}")
                # We could stop here or continue. For PGN integrity, maybe we add a comment?
                # For MVP, let's stop adding moves to PGN but continue processing to see if we can recover?
                # No, chess is state-dependent. If one move is wrong, future moves are likely invalid.
                # We'll just stop adding to the PGN object but maybe store the rest as text?
                # Let's just stop the PGN construction here and mark status.
                node.comment = f"Parsing stopped here due to illegal move: {move_str}"
                break
        
        # Export PGN
        exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
        pgn_string = game.accept(exporter)
        
        # Update DB
        cur.execute(
            "UPDATE games SET pgn = %s, status = 'completed', extracted_data = %s WHERE id = %s",
            (pgn_string, json.dumps(data), game_id)
        )
        conn.commit()
        print(f"Game {game_id} updated successfully.")

    except Exception as e:
        print(f"Error processing game {game_id}: {e}")
        cur.execute(
            "UPDATE games SET status = 'failed' WHERE id = %s",
            (game_id,)
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python process_image.py <game_id> <image_url>")
        sys.exit(1)
    
    game_id = sys.argv[1]
    image_url = sys.argv[2]
    
    process_image(game_id, image_url)
