import express from 'express';
import userRouter from './routes/user.route';
import listingRouter from './routes/listing.routes';
// import experienceRoomRouter from './routes/room.route';
import cookie from 'cookie-parser';
import errorHandler from './middlewares/error.middleware';
const app = express();

app.use(express.json());
app.use(errorHandler);
app.use(express.urlencoded({ extended: true }));
app.use(cookie());

app.use((request, response, next) => {
  console.log(
    `Incoming request: ${request.method} \n Endpoint: ${request.originalUrl}`,
  );
  next();
});

//User route
app.use('/api/v1/users', userRouter);

// //Listing route
app.use('/api/v1/users/listing', listingRouter);

// //Room route
// app.use('/api/v1/users/room', experienceRoomRouter);
export default app;
