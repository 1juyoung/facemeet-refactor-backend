import express from 'express';
import http from 'http';
import cors from 'cors';

const app = express();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);

let chatMessages = []; //채팅을 저장하기 위한 변수

app.post('/message', (req, res) => {
  const { message } = req.body;
  if (message) {
    chatMessages.push(message);
    res.status(200).json({ success: true, message: 'Message received' });
  } else {
    res.status(400).json({ success: false, message: 'No message provided' });
  }
});

app.get('/message', async (req, res) => {
  res.status(200).json(chatMessages);
});

server.listen(5000, () => console.log('Server running on port 5000'));
