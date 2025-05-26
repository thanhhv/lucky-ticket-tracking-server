import express from 'express';
import { json } from 'body-parser';
import initDatabase from './configs/db.config';
import { getPastPoolCreatedEvents, trackingEvent } from './listeners/pool.listener';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(json());

// Initialize Database
initDatabase();

trackingEvent()

// Ví dụ gọi hàm:
getPastPoolCreatedEvents(6637573, "latest");

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});