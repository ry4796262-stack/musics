import os
import json
import uuid
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join('static', 'uploads')
DATA_FILE = 'data.json'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_data():
    if not os.path.exists(DATA_FILE):
        default_data = {
            "tracks": [],
            "playlists": [
                {"id": "default", "name": "Избранное", "track_ids": []}
            ]
        }
        save_data(default_data)
        return default_data
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state', methods=['GET'])
def get_state():
    return jsonify(load_data())

@app.route('/api/tracks', methods=['POST'])
def upload_track():
    if 'file' not in request.files:
        return jsonify({"error": "Файл не найден"}), 400
    file = request.files['file']
    title = request.form.get('title', '').strip()
    artist = request.form.get('artist', 'Неизвестный исполнитель').strip()

    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({"error": "Неверный формат"}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))

    if not title:
        title = file.filename.rsplit('.', 1)[0]

    data = load_data()
    new_track = {
        "id": uuid.uuid4().hex,
        "title": title,
        "artist": artist,
        "url": f"/static/uploads/{unique_filename}",
        "filename": unique_filename
    }
    data["tracks"].append(new_track)
    save_data(data)
    return jsonify(new_track), 201

@app.route('/api/tracks/<track_id>', methods=['DELETE'])
def delete_track(track_id):
    data = load_data()
    track = next((t for t in data["tracks"] if t["id"] == track_id), None)
    if not track:
        return jsonify({"error": "Трек не найден"}), 404

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], track["filename"])
    if os.path.exists(file_path):
        os.remove(file_path)

    data["tracks"] = [t for t in data["tracks"] if t["id"] != track_id]
    for pl in data["playlists"]:
        pl["track_ids"] = [tid for tid in pl["track_ids"] if tid != track_id]

    save_data(data)
    return jsonify({"status": "deleted"})

@app.route('/api/playlists', methods=['POST'])
def create_playlist():
    body = request.get_json()
    name = body.get('name', '').strip()
    if not name:
        return jsonify({"error": "Пустое имя"}), 400

    data = load_data()
    new_pl = {
        "id": uuid.uuid4().hex,
        "name": name,
        "track_ids": []
    }
    data["playlists"].append(new_pl)
    save_data(data)
    return jsonify(new_pl), 201

@app.route('/api/playlists/<playlist_id>', methods=['DELETE'])
def delete_playlist(playlist_id):
    data = load_data()
    data["playlists"] = [p for p in data["playlists"] if p["id"] != playlist_id]
    save_data(data)
    return jsonify({"status": "deleted"})

@app.route('/api/playlists/<playlist_id>/tracks', methods=['POST'])
def add_track_to_playlist(playlist_id):
    body = request.get_json()
    track_id = body.get('track_id')
    data = load_data()

    playlist = next((p for p in data["playlists"] if p["id"] == playlist_id), None)
    if not playlist:
        return jsonify({"error": "Плейлист не найден"}), 404

    if track_id not in playlist["track_ids"]:
        playlist["track_ids"].append(track_id)
        save_data(data)

    return jsonify(playlist)

@app.route('/api/playlists/<playlist_id>/tracks/<track_id>', methods=['DELETE'])
def remove_track_from_playlist(playlist_id, track_id):
    data = load_data()
    playlist = next((p for p in data["playlists"] if p["id"] == playlist_id), None)
    if not playlist:
        return jsonify({"error": "Плейлист не найден"}), 404

    playlist["track_ids"] = [tid for tid in playlist["track_ids"] if tid != track_id]
    save_data(data)
    return jsonify(playlist)

if __name__ == '__main__':
    app.run(debug=True)