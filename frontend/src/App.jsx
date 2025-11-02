// Importing necessary libraries and dependencies
import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {
  // ================================
  //  State Variables Declaration
  // ================================
  // File upload related states
  const [fileLoading, setFileLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileText, setFileText] = useState("");
  const [fileSummary, setFileSummary] = useState("");

  // Recording related states
  const [recording, setRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");

  // References to handle audio recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // =====================================================
  //  Handle File Selection (Triggered on file input)
  // =====================================================
  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  // =====================================================
  //  Send File to Backend API for Speech-to-Text (STT)
  // =====================================================
  const handleFileSubmit = async () => {
    if (!selectedFile) {
      alert("Please, Choose the audio file!")
      return;
    }
    setFileLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Send POST request to backend endpoint
      const response = await axios.post("http://localhost:8080/stt", formData);

      // Update UI with response text and summary
      setFileText(response.data.text);
      setFileSummary(response.data.summary);
      setFileLoading(false);
    } catch (err) {
      console.error(" Error while processing file:", err);
    }
  };

  // =====================================================
  //  Start Recording User Audio
  // =====================================================
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    // Push audio data chunks as they are recorded
    mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    mediaRecorder.start();

    setRecording(true);
  };

  // =====================================================
  //  Stop Recording and Send Audio to Backend for STT
  // =====================================================
  const stopRecording = async () => {
    setRecordingLoading(true);
    mediaRecorderRef.current.stop();

    mediaRecorderRef.current.onstop = async () => {
      // Combine recorded chunks into a single audio blob
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      // Prepare form data to send to backend
      const formData = new FormData();
      formData.append("file", audioBlob, "record.webm");

      try {
        // Send POST request to backend for transcription
        const response = await axios.post("http://localhost:8080/stt", formData);

        // Update text and summary from backend response
        setText(response.data.text);
        setSummary(response.data.summary);
        setRecordingLoading(false);
      } catch (err) {
        console.error(" Error during recording upload:", err);
      }

      setRecording(false);
    };
  };

  // =====================================================
  //  Reset Buttons (Clear Text & Summary)
  // =====================================================
  const hadleFileReset = () => {
    setFileText("");
    setFileSummary("");
    setSelectedFile(null);
  };

  const handleRecordingReset = () => {
    setText("");
    setSummary("");
  };

  // =====================================================
  //  Save File Output to Backend (with Indian timestamp)
  // =====================================================
  const handleFileSave = async () => {
    if (!fileText || !fileSummary || !selectedFile) return;

    const data = {
      name: selectedFile.name,
      text: fileText,
      summary: fileSummary,
      type: "upload"
    };

    try {
      await axios.post("http://localhost:8080/save", data);
      alert(" File output saved successfully!");
    } catch (err) {
      console.error(" Error while saving file:", err);
      alert("Failed to save");
    }
  };

  // =====================================================
  //  Save Recorded Audio Output to Backend
  // =====================================================
  const handleRecordingSave = async () => {
    if (!text || !summary) return;

    const data = {
      name: "recording_output",
      text,
      summary,
      type: 'recording'
    };

    try {
      await axios.post("http://localhost:8080/save", data);
      alert(" Recording output saved successfully!");
    } catch (err) {
      console.error(" Error while saving recording:", err);
      alert("Failed to save");
    }
  };

  // =====================================================
  //  Frontend UI Layout (JSX)
  // =====================================================
  return (
    <>
      <section className="container">
        <h1>Speech to Text Converter</h1>

        <div className="wrapper-container">
          {/* =================== FILE UPLOAD SECTION =================== */}
          <div className="file-container">
            <input type="file" accept=".wav,.mp3" onChange={handleFileSelect} />
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={handleFileSubmit} className="input-btn">
                Get Output
              </button>
              {fileLoading && <p>Loading...</p>}
            </div>

            <div className="reset_save">
              <button style={{ background: "#16A34A" }} onClick={handleFileSave}>
                save
              </button>
              <button
                style={{ background: "#EF4444" }}
                onClick={hadleFileReset}
              >
                reset
              </button>
            </div>

            <div>
              <strong>Text format:</strong>
              <p>{fileText}</p>
            </div>

            <div>
              <strong>Summary:</strong>
              <p>{fileSummary}</p>
            </div>
          </div>

          {/* =================== RECORDING SECTION =================== */}
          <div className="recording-container">
            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={recordingLoading}
                className="recording-btn"
              >
                {recording ? "Stop Recording" : "Start Recording"}
              </button>
              {recordingLoading && <p>Loading...</p>}
            </div>

            <div className="reset_save">
              <button
                style={{ background: "#16A34A" }}
                onClick={handleRecordingSave}
              >
                save
              </button>
              <button
                style={{ background: "#EF4444" }}
                onClick={handleRecordingReset}
              >
                reset
              </button>
            </div>

            <div style={{ marginTop: "20px" }}>
              <strong>Text format:</strong>
              <p>{text}</p>
            </div>

            <div style={{ marginTop: "20px" }}>
              <strong>Summary:</strong>
              <p>{summary}</p>
            </div>
          </div>
        </div>
      </section>

      {/* =================== FOOTER SECTION =================== */}
      <footer>
        <div className="footer-container">
          <p>
            <span className="highlight">Speech-to-Text Converter</span> — Built
            by <span className="author">Varun Kumar</span>
          </p>

          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Contact</a>
            <a href="#">GitHub</a>
          </div>

          <p className="copyright">
            © 2025 Varun Kumar. All Rights Reserved.
          </p>
        </div>
      </footer>
    </>
  );
}

export default App;
