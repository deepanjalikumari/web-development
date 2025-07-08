import asyncHandler from '../utils/asyncHandler.util';
import verifyJwt from '../middlewares/authentication.middleware';
import {
  createListing,
  updateListing,
  getListingByUser,
  getAllListing,
  getListingById,
  deleteListing,
  searchListing,
  getNearByListing,
  approveListing,
  rejectListing,
} from '../controllers/listing.controller';
import upload from '../middlewares/multer.middleware';
import { Router } from 'express';
import isAdmin from '../middlewares/isAdmin.middleware';

const listingRouter = Router();

//Create listing
listingRouter
  .route('/create-listing')
  .post(
    verifyJwt,
    upload.fields([{ name: 'images', maxCount: 10 }]),
    asyncHandler(createListing),
  );

//Update Listing
listingRouter
  .route('/update/:itemId')
  .patch(
    verifyJwt,
    upload.fields([{ name: 'images', maxCount: 10 }]),
    asyncHandler(updateListing),
  );

// Get all listings (admin only)
listingRouter
  .route('/admin/all')
  .get(verifyJwt, isAdmin, asyncHandler(getAllListing));

// Get all listings for normal users (could be limited)
listingRouter.route('/user/all').get(verifyJwt, asyncHandler(getAllListing));

// Get listings created by the currently logged-in user
listingRouter.route('/user').get(verifyJwt, asyncHandler(getListingByUser));

//Search listing
listingRouter.route('/search').get(verifyJwt, asyncHandler(searchListing));

//Get nearby listing
listingRouter
  .route('/search/nearby')
  .get(verifyJwt, asyncHandler(getNearByListing));

// Get a single listing by ID (for both user/admin)
listingRouter.route('/:itemId').get(verifyJwt, asyncHandler(getListingById));

//Delete lisiting
listingRouter
  .route('/delete/:itemId')
  .patch(verifyJwt, asyncHandler(deleteListing));

//Approve listing
listingRouter
  .route('/approve/:itemId')
  .patch(verifyJwt, isAdmin, asyncHandler(approveListing));

//Reject listing
listingRouter
  .route('/reject/:itemId')
  .patch(verifyJwt, isAdmin, asyncHandler(rejectListing));

export default listingRouter;
