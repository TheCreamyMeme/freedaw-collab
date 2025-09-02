document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('audioCanvas');
    const ctx = canvas.getContext('2d');

    // WebSocket setup
    const ws = new WebSocket('wss://endpoint.code.bnkali.services');

    function drawWaveform(dataArray) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        const sliceWidth = Math.floor(canvas.width * 1.0 / dataArray.length);
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128;
            const y = v * canvas.height / 2;
            if(i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        ctx.stroke();
    }

    async function getAudioData(audioContext) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const analyser = audioContext.createAnalyser();

        // Fix AnalyzerNode construction and context closing issue
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 256;
        return { analyser, stream };
    }

    ws.onmessage = (event) => {
        if (audioContext && audioContext.state === 'running') {
            const audioData = JSON.parse(event.data);
            drawWaveform(audioData); // Handle receiving audio data from others
        }
    };

    let audioContext; // Audio context declaration

    document.getElementById('startButton').addEventListener('click', async () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
            const { analyser, stream } = await getAudioData(audioContext);

            // Send audio data via WebSocket continuously
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            setInterval(() => {
                analyser.getByteTimeDomainData(dataArray);
                const serializableDataArray = Array.from(dataArray); // Convert to JS object for JSON.stringification
                ws.send(JSON.stringify(serializableDataArray));
            }, 100);

        } catch (error) {
            console.error('Error starting audio data stream:', error);
        }
    });
});