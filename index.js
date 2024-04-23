import express from "express";
import morgan from "morgan";
import { Server as SocketServer } from "socket.io";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import { PORT } from "./config.js";
import router from "./routes/message.js";

// Variables globales para almacenar el contador de usuarios conectados
let connectedUsers = 0;
let newMessage = false;

// Mongoose configuration **********************************************************
const url =
  "mongodb+srv://223273:Madaga1430@cluster0.uejj3ox.mongodb.net/?retryWrites=true&w=majority";
mongoose.Promise = global.Promise;

// Nos conectamos a mongoDB.
mongoose
  .connect(url, { useNewUrlParser: true })
  .then(() => {
    console.log("Conexión con la BDD realizada con éxito!!!");
  })
  .catch(console.log);

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Manejar la conexión de los clientes
io.on("connection", (socket) => {
  // Incrementar el contador de usuarios cuando se conecta un nuevo cliente
  connectedUsers++;
  // Emitir el contador actualizado a todos los clientes
  io.emit("userCount", connectedUsers);

  // Manejar la desconexión de los clientes
  socket.on("disconnect", () => {
    // Decrementar el contador cuando un cliente se desconecta
    connectedUsers--;
    // Emitir el contador actualizado a todos los clientes
    io.emit("userCount", connectedUsers);
  });

  // Manejar los mensajes enviados por los clientes
  socket.on("message", (message, nickname) => {
    console.log(message);
    // Enviar el mensaje a todos los clientes excepto al que lo envió
    socket.broadcast.emit("message", {
      body: message,
      from: nickname,
    });
    // Actualizar la bandera de nueva notificación
    newMessage = true;
    // Emitir la notificación a todos los clientes
    io.emit("notification", newMessage);
  });
});

// Ruta para obtener la cantidad de usuarios conectados (short polling)
app.get("/api/userCount", (req, res) => {
  // Devolver el contador de usuarios conectados como respuesta
  res.json({ userCount: connectedUsers });
});

let previousMessageState = false;

// Ruta para saber si hay una nueva notificación
app.get("/api/notification", (req, res) => {
  if (newMessage) {
    // Si hay un nuevo mensaje, responder con la notificación
    res.json({ notification: true });
    newMessage = false; // Restablecer la bandera después de enviar la notificación al cliente
  } else {
    // Si no hay un nuevo mensaje, mantener la solicitud abierta
    // y responder después de un tiempo de espera
    setTimeout(() => {
      res.json({ notification: false });
    }, 30000); // Esperar 30 segundos antes de responder que no hay notificación
  }
});

// Ficheros de ruta
app.use("/api", router);

// Iniciar el servidor
server.listen(PORT, () => {
  console.log("Servidor ejecutándose en http://localhost:", PORT);
});
