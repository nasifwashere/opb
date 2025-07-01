const MarketListing = require('../db/models/Market.js');
const User = require('../db/models/User.js');

const MARKET_TAX_RATE = 0.05; // 5% tax on sales
const MAX_LISTINGS_PER_USER = 5;
const LISTING_DURATION_DAYS = 7;

/**
 * Create a new market listing
 * @param {string} sellerId - Discord user ID of seller
 * @param {string} sellerName - Discord username of seller
 * @param {Object} item - Item details
 * @param {number} price - Asking price in Beli
 * @param {string} description - Optional description
 * @returns {Object} Result object with success status and message
 */
async function createListing(sellerId, sellerName, item, price, description = '') {
  try {
    // Check user's active listings count
    const activeListings = await MarketListing.countDocuments({
      sellerId: sellerId,
      active: true,
      expiresAt: { $gt: new Date() }
    });

    if (activeListings >= MAX_LISTINGS_PER_USER) {
      return {
        success: false,
        message: `You can only have ${MAX_LISTINGS_PER_USER} active listings at a time.`
      };
    }

    // Create the listing
    const listing = new MarketListing({
      sellerId: sellerId,
      sellerName: sellerName,
      type: item.type,
      itemName: item.name,
      itemRank: item.rank,
      itemLevel: item.level,
      price: price,
      description: description,
      expiresAt: new Date(Date.now() + (LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000))
    });

    await listing.save();

    return {
      success: true,
      message: `Successfully listed ${item.name} for ${price} Beli!`,
      listingId: listing._id
    };
  } catch (error) {
    console.error('Error creating market listing:', error);
    return {
      success: false,
      message: 'Failed to create listing. Please try again.'
    };
  }
}

/**
 * Purchase an item from the market
 * @param {string} buyerId - Discord user ID of buyer
 * @param {string} listingId - ID of the listing to purchase
 * @returns {Object} Result object with success status and message
 */
async function purchaseItem(buyerId, listingId) {
  try {
    // Find the listing
    const listing = await MarketListing.findOne({
      _id: listingId,
      active: true,
      expiresAt: { $gt: new Date() }
    });

    if (!listing) {
      return {
        success: false,
        message: 'Listing not found or has expired.'
      };
    }

    // Prevent self-purchase
    if (listing.sellerId === buyerId) {
      return {
        success: false,
        message: 'You cannot buy your own listing!'
      };
    }

    // Get buyer and seller
    const buyer = await User.findOne({ userId: buyerId });
    const seller = await User.findOne({ userId: listing.sellerId });

    if (!buyer || !seller) {
      return {
        success: false,
        message: 'User not found.'
      };
    }

    // Check buyer has enough Beli
    if (buyer.beli < listing.price) {
      return {
        success: false,
        message: `You need ${listing.price} Beli but only have ${buyer.beli}.`
      };
    }

    // Calculate tax and seller amount
    const tax = Math.floor(listing.price * MARKET_TAX_RATE);
    const sellerAmount = listing.price - tax;

    // Process the transaction
    buyer.beli -= listing.price;
    seller.beli += sellerAmount;

    // Transfer the item to buyer
    if (listing.type === 'card') {
      if (!buyer.cards) buyer.cards = [];
      buyer.cards.push({
        name: listing.itemName,
        rank: listing.itemRank,
        level: listing.itemLevel || 1,
        timesUpgraded: 0,
        locked: false
      });
    } else if (listing.type === 'item') {
      if (!buyer.inventory) buyer.inventory = [];
      buyer.inventory.push(listing.itemName.toLowerCase().replace(/\s+/g, ''));
    }

    // Mark listing as sold
    listing.active = false;

    // Save all changes
    await Promise.all([
      buyer.save(),
      seller.save(),
      listing.save()
    ]);

    // Update quest progress for market transactions
    const { updateQuestProgress } = require('./questSystem');
    await updateQuestProgress(buyer, 'market_buy', 1);
    await updateQuestProgress(seller, 'market_sell', 1);

    return {
      success: true,
      message: `Successfully purchased ${listing.itemName} for ${listing.price} Beli!`,
      item: {
        name: listing.itemName,
        type: listing.type,
        rank: listing.itemRank,
        level: listing.itemLevel
      },
      tax: tax
    };
  } catch (error) {
    console.error('Error purchasing item:', error);
    return {
      success: false,
      message: 'Failed to purchase item. Please try again.'
    };
  }
}

/**
 * Remove a user's listing
 * @param {string} userId - Discord user ID
 * @param {string} listingId - ID of the listing to remove
 * @returns {Object} Result object with success status and message
 */
async function removeListing(userId, listingId) {
  try {
    const listing = await MarketListing.findOne({
      _id: listingId,
      sellerId: userId,
      active: true
    });

    if (!listing) {
      return {
        success: false,
        message: 'Listing not found or you do not own this listing.'
      };
    }

    // Return item to user
    const user = await User.findOne({ userId: userId });
    if (user) {
      if (listing.type === 'card') {
        if (!user.cards) user.cards = [];
        user.cards.push({
          name: listing.itemName,
          rank: listing.itemRank,
          level: listing.itemLevel || 1,
          timesUpgraded: 0,
          locked: false
        });
      } else if (listing.type === 'item') {
        if (!user.inventory) user.inventory = [];
        user.inventory.push(listing.itemName.toLowerCase().replace(/\s+/g, ''));
      }
      await user.save();
    }

    // Remove the listing
    listing.active = false;
    await listing.save();

    return {
      success: true,
      message: `Removed listing for ${listing.itemName}. Item returned to your inventory.`
    };
  } catch (error) {
    console.error('Error removing listing:', error);
    return {
      success: false,
      message: 'Failed to remove listing. Please try again.'
    };
  }
}

/**
 * Get market listings with filters
 * @param {Object} filters - Filter options
 * @param {number} page - Page number (0-based)
 * @param {number} limit - Items per page
 * @returns {Object} Object containing listings and pagination info
 */
async function getMarketListings(filters = {}, page = 0, limit = 10) {
  try {
    const query = {
      active: true,
      expiresAt: { $gt: new Date() }
    };

    // Apply filters
    if (filters.type) {
      query.type = filters.type;
    }
    if (filters.minPrice || filters.maxPrice) {
      query.price = {};
      if (filters.minPrice) query.price.$gte = filters.minPrice;
      if (filters.maxPrice) query.price.$lte = filters.maxPrice;
    }
    if (filters.rank) {
      query.itemRank = filters.rank;
    }
    if (filters.search) {
      query.itemName = { $regex: filters.search, $options: 'i' };
    }

    const skip = page * limit;

    const [listings, totalCount] = await Promise.all([
      MarketListing.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MarketListing.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      listings: listings,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalCount,
        hasNext: page < totalPages - 1,
        hasPrev: page > 0
      }
    };
  } catch (error) {
    console.error('Error getting market listings:', error);
    return {
      success: false,
      message: 'Failed to load market listings.',
      listings: [],
      pagination: null
    };
  }
}

/**
 * Clean up expired listings
 * @returns {number} Number of listings cleaned up
 */
async function cleanupExpiredListings() {
  try {
    const result = await MarketListing.updateMany(
      {
        active: true,
        expiresAt: { $lt: new Date() }
      },
      {
        $set: { active: false }
      }
    );

    console.log(`[MARKET] Cleaned up ${result.modifiedCount} expired listings`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error cleaning up expired listings:', error);
    return 0;
  }
}

/**
 * Get user's active listings
 * @param {string} userId - Discord user ID
 * @returns {Array} Array of user's active listings
 */
async function getUserListings(userId) {
  try {
    const listings = await MarketListing.find({
      sellerId: userId,
      active: true,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    return listings;
  } catch (error) {
    console.error('Error getting user listings:', error);
    return [];
  }
}

module.exports = {
  createListing,
  purchaseItem,
  removeListing,
  getMarketListings,
  cleanupExpiredListings,
  getUserListings
};