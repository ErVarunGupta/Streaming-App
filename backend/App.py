# -----------------------------
#  Speech-to-Text + Summarizer Backend
# -----------------------------
'''
Model paths:
     stt-model path link: https://drive.google.com/drive/folders/1E2-9fY-ck81wPjzCsSwe46n2KH0kc7vG?usp=drive_link
     train test datasets link: https://drive.google.com/drive/folders/1oOKY41udDyxTPFH4vE0V-VHbGfNKSlKp?usp=drive_link
     pre-trained model link: https://drive.google.com/drive/folders/1X7fTdQjSoPp3P9Q30lfQyftKUxuv3FPq?usp=drive_link
       {
           training an STT model completely from zero parameters requires thousands of hours of labeled speech and weeks of GPU training.
           Built full training pipeline from scratch but fine-tuned a pretrained Wav2Vec2 model (not trained from zero) for better accuracy and faster convergence.
        }
'''
# ----------------------------------------------

from flask import Flask, request, jsonify
from flask_cors import CORS
import librosa, soundfile as sf, noisereduce as nr
from transformers import pipeline
from pydub import AudioSegment
import io
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# -----------------------------
#  Folder Setup
# -----------------------------
SAVE_FOLDER = "../outputs"
UPLOAD_FOLDER = os.path.join(SAVE_FOLDER, "uploads")
RECORDINGS_FOLDER = os.path.join(SAVE_FOLDER, "recordings")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RECORDINGS_FOLDER, exist_ok=True)

# -----------------------------
#  Load Models
# -----------------------------

'''
# Load local Speech-to-Text model 
model_path = os.path.abspath("stt-model")

asr = pipeline(
    "automatic-speech-recognition",
    model=model_path,
    tokenizer=model_path
)
'''

# Load pretrained model
asr = pipeline("automatic-speech-recognition", model="openai/whisper-tiny")

# Load summarization model
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

# -----------------------------
#  Audio Processing Functions
# -----------------------------
def convert_to_wav(file_bytes):
    """Convert any uploaded audio (e.g., webm/mp3) into WAV format."""
    audio = AudioSegment.from_file(io.BytesIO(file_bytes))
    wav_buffer = io.BytesIO()
    audio.export(wav_buffer, format="wav")
    wav_buffer.seek(0)
    return wav_buffer


def clean_audio(file_bytes):
    """Normalize, denoise, and trim silence from audio."""
    y, sr = librosa.load(io.BytesIO(file_bytes), sr=16000, mono=True)
    y = librosa.util.normalize(y)
    y = nr.reduce_noise(y=y, sr=sr)
    y, _ = librosa.effects.trim(y, top_db=20)
    temp_buffer = io.BytesIO()
    sf.write(temp_buffer, y, sr, format='WAV')
    temp_buffer.seek(0)
    return temp_buffer

# -----------------------------
#  STT + Summarization Route
# -----------------------------
@app.route('/stt', methods=['POST'])
def stt():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']

    # Step 1: Convert webm/mp3 → wav
    wav_audio = convert_to_wav(file.read())

    # Step 2: Clean the WAV audio
    cleaned_audio = clean_audio(wav_audio.read())

    # Step 3: Transcribe using Whisper
    result = asr(cleaned_audio.read(), return_timestamps=True)
    text = result['text']

    # Step 4: Summarize the text
    summary = summarizer(
        text,
        max_length=100,
        min_length=30,
        do_sample=False
    )[0]['summary_text']

    return jsonify({"text": text, "summary": summary})

# -----------------------------
#  Save Output Route
# -----------------------------
@app.route('/save', methods=['POST'])
def save():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    filename = data.get("name", "audio_output")
    text = data.get("text", "")
    summary = data.get("summary", "")
    file_type = data.get("type", "upload")  # either 'upload' or 'recording'

    if not text or not summary:
        return jsonify({"error": "Missing text or summary"}), 400

    # Determine save folder
    folder = UPLOAD_FOLDER if file_type == "upload" else RECORDINGS_FOLDER

    # Clean filename and generate unique name
    safe_filename = os.path.basename(filename)
    base_name = os.path.splitext(safe_filename)[0]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    save_name = f"{base_name}_{timestamp}.txt"
    save_path = os.path.join(folder, save_name)

    # Save to text file
    with open(save_path, "w", encoding="utf-8") as f:
        f.write("# Transcribed Text:\n")
        f.write(text.strip() + "\n\n")
        f.write("# Summary:\n")
        f.write(summary.strip())

    return jsonify({"message": f" File saved successfully at {save_path}"}), 200

# -----------------------------
#  Run Server
# -----------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
