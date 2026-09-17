BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [passwordHash] NVARCHAR(1000),
    [googleId] NVARCHAR(1000),
    [name] NVARCHAR(1000) NOT NULL,
    [avatarUrl] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [User_status_df] DEFAULT 'ACTIVE',
    [emailVerifiedAt] DATETIME2,
    [phoneVerifiedAt] DATETIME2,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [User_phone_key] UNIQUE NONCLUSTERED ([phone]),
    CONSTRAINT [User_googleId_key] UNIQUE NONCLUSTERED ([googleId])
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [permissions] NVARCHAR(max) NOT NULL,
    [isSystem] BIT NOT NULL CONSTRAINT [Role_isSystem_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[UserRole] (
    [userId] NVARCHAR(1000) NOT NULL,
    [roleId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [UserRole_pkey] PRIMARY KEY CLUSTERED ([userId],[roleId])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshToken] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [userAgent] NVARCHAR(1000),
    [ip] NVARCHAR(1000),
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RefreshToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RefreshToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RefreshToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[OtpCode] (
    [id] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000) NOT NULL,
    [codeHash] NVARCHAR(1000) NOT NULL,
    [purpose] NVARCHAR(1000) NOT NULL CONSTRAINT [OtpCode_purpose_df] DEFAULT 'LOGIN',
    [attempts] INT NOT NULL CONSTRAINT [OtpCode_attempts_df] DEFAULT 0,
    [expiresAt] DATETIME2 NOT NULL,
    [consumedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OtpCode_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [OtpCode_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Address] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000) NOT NULL,
    [line1] NVARCHAR(1000) NOT NULL,
    [line2] NVARCHAR(1000),
    [area] NVARCHAR(1000),
    [city] NVARCHAR(1000) NOT NULL,
    [state] NVARCHAR(1000) NOT NULL,
    [country] NVARCHAR(1000) NOT NULL CONSTRAINT [Address_country_df] DEFAULT 'India',
    [pincode] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [Address_type_df] DEFAULT 'HOME',
    [isDefault] BIT NOT NULL CONSTRAINT [Address_isDefault_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Address_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Address_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Category] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(1000) NOT NULL,
    [parentId] NVARCHAR(1000),
    [imageUrl] NVARCHAR(1000),
    [iconName] NVARCHAR(1000),
    [sortOrder] INT NOT NULL CONSTRAINT [Category_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Category_isActive_df] DEFAULT 1,
    [isFeatured] BIT NOT NULL CONSTRAINT [Category_isFeatured_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Category_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Category_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Category_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[Brand] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(1000) NOT NULL,
    [logoUrl] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Brand_isActive_df] DEFAULT 1,
    [isFeatured] BIT NOT NULL CONSTRAINT [Brand_isFeatured_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Brand_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Brand_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Brand_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [Brand_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[Product] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(1000) NOT NULL,
    [sku] NVARCHAR(1000) NOT NULL,
    [categoryId] NVARCHAR(1000) NOT NULL,
    [brandId] NVARCHAR(1000),
    [description] NVARCHAR(max) NOT NULL,
    [shortDescription] NVARCHAR(1000),
    [specifications] NVARCHAR(max),
    [features] NVARCHAR(max),
    [optionTypes] NVARCHAR(max),
    [warranty] NVARCHAR(1000),
    [returnPolicy] NVARCHAR(1000),
    [returnWindowDays] INT NOT NULL CONSTRAINT [Product_returnWindowDays_df] DEFAULT 7,
    [isReturnable] BIT NOT NULL CONSTRAINT [Product_isReturnable_df] DEFAULT 1,
    [codAvailable] BIT NOT NULL CONSTRAINT [Product_codAvailable_df] DEFAULT 1,
    [taxRatePct] DECIMAL(5,2) NOT NULL CONSTRAINT [Product_taxRatePct_df] DEFAULT 18,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Product_status_df] DEFAULT 'DRAFT',
    [isFeatured] BIT NOT NULL CONSTRAINT [Product_isFeatured_df] DEFAULT 0,
    [minPrice] DECIMAL(12,2) NOT NULL CONSTRAINT [Product_minPrice_df] DEFAULT 0,
    [maxMrp] DECIMAL(12,2) NOT NULL CONSTRAINT [Product_maxMrp_df] DEFAULT 0,
    [ratingAvg] DECIMAL(3,2) NOT NULL CONSTRAINT [Product_ratingAvg_df] DEFAULT 0,
    [ratingCount] INT NOT NULL CONSTRAINT [Product_ratingCount_df] DEFAULT 0,
    [reviewCount] INT NOT NULL CONSTRAINT [Product_reviewCount_df] DEFAULT 0,
    [soldCount] INT NOT NULL CONSTRAINT [Product_soldCount_df] DEFAULT 0,
    [viewCount] INT NOT NULL CONSTRAINT [Product_viewCount_df] DEFAULT 0,
    [wishlistCount] INT NOT NULL CONSTRAINT [Product_wishlistCount_df] DEFAULT 0,
    [seoTitle] NVARCHAR(1000),
    [seoDescription] NVARCHAR(1000),
    [seoKeywords] NVARCHAR(1000),
    [publishedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Product_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Product_slug_key] UNIQUE NONCLUSTERED ([slug]),
    CONSTRAINT [Product_sku_key] UNIQUE NONCLUSTERED ([sku])
);

-- CreateTable
CREATE TABLE [dbo].[ProductVariant] (
    [id] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [sku] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [options] NVARCHAR(max),
    [mrp] DECIMAL(12,2) NOT NULL,
    [price] DECIMAL(12,2) NOT NULL,
    [costPrice] DECIMAL(12,2),
    [weightGrams] INT,
    [dimensions] NVARCHAR(1000),
    [stockOnHand] INT NOT NULL CONSTRAINT [ProductVariant_stockOnHand_df] DEFAULT 0,
    [stockReserved] INT NOT NULL CONSTRAINT [ProductVariant_stockReserved_df] DEFAULT 0,
    [lowStockThreshold] INT NOT NULL CONSTRAINT [ProductVariant_lowStockThreshold_df] DEFAULT 5,
    [isDefault] BIT NOT NULL CONSTRAINT [ProductVariant_isDefault_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [ProductVariant_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductVariant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [ProductVariant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProductVariant_sku_key] UNIQUE NONCLUSTERED ([sku])
);

-- CreateTable
CREATE TABLE [dbo].[ProductImage] (
    [id] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [variantId] NVARCHAR(1000),
    [url] NVARCHAR(1000) NOT NULL,
    [alt] NVARCHAR(1000),
    [sortOrder] INT NOT NULL CONSTRAINT [ProductImage_sortOrder_df] DEFAULT 0,
    [isPrimary] BIT NOT NULL CONSTRAINT [ProductImage_isPrimary_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductImage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ProductImage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PriceHistory] (
    [id] NVARCHAR(1000) NOT NULL,
    [variantId] NVARCHAR(1000) NOT NULL,
    [mrp] DECIMAL(12,2) NOT NULL,
    [price] DECIMAL(12,2) NOT NULL,
    [changedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PriceHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PriceHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[InventoryTransaction] (
    [id] NVARCHAR(1000) NOT NULL,
    [variantId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [qty] INT NOT NULL,
    [balanceAfter] INT NOT NULL,
    [reason] NVARCHAR(1000),
    [orderId] NVARCHAR(1000),
    [actorId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryTransaction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InventoryTransaction_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Cart] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [couponCode] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Cart_status_df] DEFAULT 'ACTIVE',
    [lastActivityAt] DATETIME2 NOT NULL CONSTRAINT [Cart_lastActivityAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Cart_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Cart_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Cart_userId_key] UNIQUE NONCLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[CartItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [cartId] NVARCHAR(1000) NOT NULL,
    [variantId] NVARCHAR(1000) NOT NULL,
    [qty] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CartItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CartItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CartItem_cartId_variantId_key] UNIQUE NONCLUSTERED ([cartId],[variantId])
);

-- CreateTable
CREATE TABLE [dbo].[WishlistItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [priceAtAdd] DECIMAL(12,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WishlistItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WishlistItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WishlistItem_userId_productId_key] UNIQUE NONCLUSTERED ([userId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[RecentlyViewed] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [viewedAt] DATETIME2 NOT NULL CONSTRAINT [RecentlyViewed_viewedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RecentlyViewed_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RecentlyViewed_userId_productId_key] UNIQUE NONCLUSTERED ([userId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[Order] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderNumber] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_status_df] DEFAULT 'PENDING_PAYMENT',
    [paymentStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_paymentStatus_df] DEFAULT 'PENDING',
    [paymentMethod] NVARCHAR(1000),
    [shippingAddress] NVARCHAR(max) NOT NULL,
    [billingAddress] NVARCHAR(max),
    [subtotal] DECIMAL(12,2) NOT NULL,
    [productDiscount] DECIMAL(12,2) NOT NULL CONSTRAINT [Order_productDiscount_df] DEFAULT 0,
    [offerDiscount] DECIMAL(12,2) NOT NULL CONSTRAINT [Order_offerDiscount_df] DEFAULT 0,
    [couponDiscount] DECIMAL(12,2) NOT NULL CONSTRAINT [Order_couponDiscount_df] DEFAULT 0,
    [couponCode] NVARCHAR(1000),
    [shippingFee] DECIMAL(12,2) NOT NULL CONSTRAINT [Order_shippingFee_df] DEFAULT 0,
    [taxAmount] DECIMAL(12,2) NOT NULL CONSTRAINT [Order_taxAmount_df] DEFAULT 0,
    [total] DECIMAL(12,2) NOT NULL,
    [shippingZoneId] NVARCHAR(1000),
    [trackingNumber] NVARCHAR(1000),
    [courierName] NVARCHAR(1000),
    [expectedDeliveryAt] DATETIME2,
    [customerNote] NVARCHAR(1000),
    [adminNote] NVARCHAR(max),
    [idempotencyKey] NVARCHAR(1000),
    [cancelReason] NVARCHAR(1000),
    [placedAt] DATETIME2 NOT NULL CONSTRAINT [Order_placedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [confirmedAt] DATETIME2,
    [shippedAt] DATETIME2,
    [deliveredAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Order_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Order_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Order_orderNumber_key] UNIQUE NONCLUSTERED ([orderNumber]),
    CONSTRAINT [Order_idempotencyKey_key] UNIQUE NONCLUSTERED ([idempotencyKey])
);

-- CreateTable
CREATE TABLE [dbo].[OrderItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [variantId] NVARCHAR(1000) NOT NULL,
    [nameSnapshot] NVARCHAR(1000) NOT NULL,
    [skuSnapshot] NVARCHAR(1000) NOT NULL,
    [imageSnapshot] NVARCHAR(1000),
    [optionsSnapshot] NVARCHAR(max),
    [unitMrp] DECIMAL(12,2) NOT NULL,
    [unitPrice] DECIMAL(12,2) NOT NULL,
    [qty] INT NOT NULL,
    [lineTotal] DECIMAL(12,2) NOT NULL,
    [taxRatePct] DECIMAL(5,2) NOT NULL CONSTRAINT [OrderItem_taxRatePct_df] DEFAULT 18,
    [returnedQty] INT NOT NULL CONSTRAINT [OrderItem_returnedQty_df] DEFAULT 0,
    CONSTRAINT [OrderItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OrderStatusHistory] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [fromStatus] NVARCHAR(1000),
    [toStatus] NVARCHAR(1000) NOT NULL,
    [note] NVARCHAR(1000),
    [actorId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OrderStatusHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [OrderStatusHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Payment] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [provider] NVARCHAR(1000) NOT NULL,
    [providerOrderId] NVARCHAR(1000),
    [providerPaymentId] NVARCHAR(1000),
    [amount] DECIMAL(12,2) NOT NULL,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [Payment_currency_df] DEFAULT 'INR',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Payment_status_df] DEFAULT 'CREATED',
    [method] NVARCHAR(1000),
    [errorReason] NVARCHAR(1000),
    [verifiedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Payment_providerPaymentId_key] UNIQUE NONCLUSTERED ([providerPaymentId])
);

-- CreateTable
CREATE TABLE [dbo].[WebhookEvent] (
    [id] NVARCHAR(1000) NOT NULL,
    [provider] NVARCHAR(1000) NOT NULL,
    [eventId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [processedAt] DATETIME2,
    [error] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WebhookEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WebhookEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WebhookEvent_provider_eventId_key] UNIQUE NONCLUSTERED ([provider],[eventId])
);

-- CreateTable
CREATE TABLE [dbo].[Refund] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [paymentId] NVARCHAR(1000),
    [amount] DECIMAL(12,2) NOT NULL,
    [reason] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Refund_status_df] DEFAULT 'PENDING',
    [providerRefundId] NVARCHAR(1000),
    [initiatedById] NVARCHAR(1000),
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Refund_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Refund_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Coupon] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [type] NVARCHAR(1000) NOT NULL,
    [value] DECIMAL(12,2) NOT NULL,
    [minOrderAmount] DECIMAL(12,2) NOT NULL CONSTRAINT [Coupon_minOrderAmount_df] DEFAULT 0,
    [maxDiscount] DECIMAL(12,2),
    [startsAt] DATETIME2,
    [endsAt] DATETIME2,
    [usageLimit] INT,
    [perUserLimit] INT NOT NULL CONSTRAINT [Coupon_perUserLimit_df] DEFAULT 1,
    [usedCount] INT NOT NULL CONSTRAINT [Coupon_usedCount_df] DEFAULT 0,
    [firstOrderOnly] BIT NOT NULL CONSTRAINT [Coupon_firstOrderOnly_df] DEFAULT 0,
    [appliesTo] NVARCHAR(1000) NOT NULL CONSTRAINT [Coupon_appliesTo_df] DEFAULT 'ALL',
    [isActive] BIT NOT NULL CONSTRAINT [Coupon_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Coupon_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Coupon_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Coupon_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[CouponProduct] (
    [couponId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [CouponProduct_pkey] PRIMARY KEY CLUSTERED ([couponId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[CouponCategory] (
    [couponId] NVARCHAR(1000) NOT NULL,
    [categoryId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [CouponCategory_pkey] PRIMARY KEY CLUSTERED ([couponId],[categoryId])
);

-- CreateTable
CREATE TABLE [dbo].[CouponRedemption] (
    [id] NVARCHAR(1000) NOT NULL,
    [couponId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(12,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CouponRedemption_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CouponRedemption_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CouponRedemption_couponId_orderId_key] UNIQUE NONCLUSTERED ([couponId],[orderId])
);

-- CreateTable
CREATE TABLE [dbo].[Offer] (
    [id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [badgeText] NVARCHAR(1000),
    [type] NVARCHAR(1000) NOT NULL,
    [value] DECIMAL(12,2) NOT NULL,
    [maxDiscount] DECIMAL(12,2),
    [appliesTo] NVARCHAR(1000) NOT NULL CONSTRAINT [Offer_appliesTo_df] DEFAULT 'ALL',
    [priority] INT NOT NULL CONSTRAINT [Offer_priority_df] DEFAULT 0,
    [startsAt] DATETIME2,
    [endsAt] DATETIME2,
    [isFlashSale] BIT NOT NULL CONSTRAINT [Offer_isFlashSale_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Offer_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Offer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Offer_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OfferProduct] (
    [offerId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [OfferProduct_pkey] PRIMARY KEY CLUSTERED ([offerId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[OfferCategory] (
    [offerId] NVARCHAR(1000) NOT NULL,
    [categoryId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [OfferCategory_pkey] PRIMARY KEY CLUSTERED ([offerId],[categoryId])
);

-- CreateTable
CREATE TABLE [dbo].[Review] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [orderItemId] NVARCHAR(1000),
    [rating] INT NOT NULL,
    [title] NVARCHAR(1000),
    [body] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Review_status_df] DEFAULT 'PENDING',
    [isVerified] BIT NOT NULL CONSTRAINT [Review_isVerified_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Review_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Review_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Review_userId_productId_key] UNIQUE NONCLUSTERED ([userId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[ReviewImage] (
    [id] NVARCHAR(1000) NOT NULL,
    [reviewId] NVARCHAR(1000) NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [ReviewImage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ReturnRequest] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ReturnRequest_status_df] DEFAULT 'REQUESTED',
    [reason] NVARCHAR(1000) NOT NULL,
    [comments] NVARCHAR(max),
    [adminComment] NVARCHAR(1000),
    [refundAmount] DECIMAL(12,2),
    [resolvedById] NVARCHAR(1000),
    [resolvedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ReturnRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ReturnRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ReturnItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [returnRequestId] NVARCHAR(1000) NOT NULL,
    [orderItemId] NVARCHAR(1000) NOT NULL,
    [qty] INT NOT NULL,
    CONSTRAINT [ReturnItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000),
    [audience] NVARCHAR(1000) NOT NULL CONSTRAINT [Notification_audience_df] DEFAULT 'USER',
    [type] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [body] NVARCHAR(1000),
    [data] NVARCHAR(max),
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Banner] (
    [id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [subtitle] NVARCHAR(1000),
    [imageUrl] NVARCHAR(1000) NOT NULL,
    [mobileImageUrl] NVARCHAR(1000),
    [linkUrl] NVARCHAR(1000),
    [placement] NVARCHAR(1000) NOT NULL CONSTRAINT [Banner_placement_df] DEFAULT 'HERO',
    [sortOrder] INT NOT NULL CONSTRAINT [Banner_sortOrder_df] DEFAULT 0,
    [startsAt] DATETIME2,
    [endsAt] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [Banner_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Banner_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Banner_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[HomeSection] (
    [id] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [config] NVARCHAR(max),
    [sortOrder] INT NOT NULL CONSTRAINT [HomeSection_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [HomeSection_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [HomeSection_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [HomeSection_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [HomeSection_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[ShippingZone] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [fee] DECIMAL(12,2) NOT NULL,
    [freeAbove] DECIMAL(12,2),
    [minDeliveryDays] INT NOT NULL CONSTRAINT [ShippingZone_minDeliveryDays_df] DEFAULT 3,
    [maxDeliveryDays] INT NOT NULL CONSTRAINT [ShippingZone_maxDeliveryDays_df] DEFAULT 7,
    [codAvailable] BIT NOT NULL CONSTRAINT [ShippingZone_codAvailable_df] DEFAULT 1,
    [isDefault] BIT NOT NULL CONSTRAINT [ShippingZone_isDefault_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [ShippingZone_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ShippingZone_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ShippingZone_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ZonePincode] (
    [id] NVARCHAR(1000) NOT NULL,
    [zoneId] NVARCHAR(1000) NOT NULL,
    [pincode] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [ZonePincode_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Setting] (
    [id] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(max) NOT NULL,
    [group] NVARCHAR(1000) NOT NULL CONSTRAINT [Setting_group_df] DEFAULT 'general',
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Setting_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Setting_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [action] NVARCHAR(1000) NOT NULL,
    [entity] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000),
    [metadata] NVARCHAR(max),
    [ip] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SearchQuery] (
    [id] NVARCHAR(1000) NOT NULL,
    [term] NVARCHAR(1000) NOT NULL,
    [count] INT NOT NULL CONSTRAINT [SearchQuery_count_df] DEFAULT 1,
    [lastSearchedAt] DATETIME2 NOT NULL CONSTRAINT [SearchQuery_lastSearchedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SearchQuery_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SearchQuery_term_key] UNIQUE NONCLUSTERED ([term])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_status_idx] ON [dbo].[User]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_createdAt_idx] ON [dbo].[User]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_userId_idx] ON [dbo].[RefreshToken]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_expiresAt_idx] ON [dbo].[RefreshToken]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OtpCode_phone_purpose_idx] ON [dbo].[OtpCode]([phone], [purpose]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Address_userId_idx] ON [dbo].[Address]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Category_parentId_idx] ON [dbo].[Category]([parentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Category_isActive_sortOrder_idx] ON [dbo].[Category]([isActive], [sortOrder]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_categoryId_status_idx] ON [dbo].[Product]([categoryId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_brandId_idx] ON [dbo].[Product]([brandId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_status_isFeatured_idx] ON [dbo].[Product]([status], [isFeatured]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_createdAt_idx] ON [dbo].[Product]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_soldCount_idx] ON [dbo].[Product]([soldCount]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_ratingAvg_idx] ON [dbo].[Product]([ratingAvg]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_minPrice_idx] ON [dbo].[Product]([minPrice]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProductVariant_productId_idx] ON [dbo].[ProductVariant]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProductVariant_stockOnHand_idx] ON [dbo].[ProductVariant]([stockOnHand]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProductImage_productId_sortOrder_idx] ON [dbo].[ProductImage]([productId], [sortOrder]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PriceHistory_variantId_createdAt_idx] ON [dbo].[PriceHistory]([variantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryTransaction_variantId_createdAt_idx] ON [dbo].[InventoryTransaction]([variantId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InventoryTransaction_orderId_idx] ON [dbo].[InventoryTransaction]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Cart_status_lastActivityAt_idx] ON [dbo].[Cart]([status], [lastActivityAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RecentlyViewed_userId_viewedAt_idx] ON [dbo].[RecentlyViewed]([userId], [viewedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_userId_createdAt_idx] ON [dbo].[Order]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_status_idx] ON [dbo].[Order]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_paymentStatus_idx] ON [dbo].[Order]([paymentStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_createdAt_idx] ON [dbo].[Order]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderItem_orderId_idx] ON [dbo].[OrderItem]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderItem_productId_idx] ON [dbo].[OrderItem]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderStatusHistory_orderId_createdAt_idx] ON [dbo].[OrderStatusHistory]([orderId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_orderId_idx] ON [dbo].[Payment]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_status_idx] ON [dbo].[Payment]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_createdAt_idx] ON [dbo].[Payment]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Refund_orderId_idx] ON [dbo].[Refund]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Refund_status_idx] ON [dbo].[Refund]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Coupon_isActive_idx] ON [dbo].[Coupon]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CouponRedemption_couponId_userId_idx] ON [dbo].[CouponRedemption]([couponId], [userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Offer_isActive_idx] ON [dbo].[Offer]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Review_productId_status_idx] ON [dbo].[Review]([productId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ReturnRequest_orderId_idx] ON [dbo].[ReturnRequest]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ReturnRequest_status_idx] ON [dbo].[ReturnRequest]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_readAt_idx] ON [dbo].[Notification]([userId], [readAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_audience_createdAt_idx] ON [dbo].[Notification]([audience], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Banner_placement_isActive_sortOrder_idx] ON [dbo].[Banner]([placement], [isActive], [sortOrder]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ZonePincode_pincode_idx] ON [dbo].[ZonePincode]([pincode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ZonePincode_zoneId_idx] ON [dbo].[ZonePincode]([zoneId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_entity_entityId_idx] ON [dbo].[AuditLog]([entity], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_actorId_createdAt_idx] ON [dbo].[AuditLog]([actorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_createdAt_idx] ON [dbo].[AuditLog]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SearchQuery_count_idx] ON [dbo].[SearchQuery]([count]);

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshToken] ADD CONSTRAINT [RefreshToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Address] ADD CONSTRAINT [Address_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Category] ADD CONSTRAINT [Category_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_brandId_fkey] FOREIGN KEY ([brandId]) REFERENCES [dbo].[Brand]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductVariant] ADD CONSTRAINT [ProductVariant_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductImage] ADD CONSTRAINT [ProductImage_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductImage] ADD CONSTRAINT [ProductImage_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PriceHistory] ADD CONSTRAINT [PriceHistory_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryTransaction] ADD CONSTRAINT [InventoryTransaction_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventoryTransaction] ADD CONSTRAINT [InventoryTransaction_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Cart] ADD CONSTRAINT [Cart_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_cartId_fkey] FOREIGN KEY ([cartId]) REFERENCES [dbo].[Cart]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WishlistItem] ADD CONSTRAINT [WishlistItem_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WishlistItem] ADD CONSTRAINT [WishlistItem_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RecentlyViewed] ADD CONSTRAINT [RecentlyViewed_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RecentlyViewed] ADD CONSTRAINT [RecentlyViewed_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [Order_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderStatusHistory] ADD CONSTRAINT [OrderStatusHistory_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderStatusHistory] ADD CONSTRAINT [OrderStatusHistory_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Refund] ADD CONSTRAINT [Refund_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Refund] ADD CONSTRAINT [Refund_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Refund] ADD CONSTRAINT [Refund_initiatedById_fkey] FOREIGN KEY ([initiatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponProduct] ADD CONSTRAINT [CouponProduct_couponId_fkey] FOREIGN KEY ([couponId]) REFERENCES [dbo].[Coupon]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponProduct] ADD CONSTRAINT [CouponProduct_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponCategory] ADD CONSTRAINT [CouponCategory_couponId_fkey] FOREIGN KEY ([couponId]) REFERENCES [dbo].[Coupon]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponCategory] ADD CONSTRAINT [CouponCategory_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponRedemption] ADD CONSTRAINT [CouponRedemption_couponId_fkey] FOREIGN KEY ([couponId]) REFERENCES [dbo].[Coupon]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponRedemption] ADD CONSTRAINT [CouponRedemption_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponRedemption] ADD CONSTRAINT [CouponRedemption_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferProduct] ADD CONSTRAINT [OfferProduct_offerId_fkey] FOREIGN KEY ([offerId]) REFERENCES [dbo].[Offer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferProduct] ADD CONSTRAINT [OfferProduct_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferCategory] ADD CONSTRAINT [OfferCategory_offerId_fkey] FOREIGN KEY ([offerId]) REFERENCES [dbo].[Offer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferCategory] ADD CONSTRAINT [OfferCategory_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_orderItemId_fkey] FOREIGN KEY ([orderItemId]) REFERENCES [dbo].[OrderItem]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReviewImage] ADD CONSTRAINT [ReviewImage_reviewId_fkey] FOREIGN KEY ([reviewId]) REFERENCES [dbo].[Review]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReturnRequest] ADD CONSTRAINT [ReturnRequest_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReturnRequest] ADD CONSTRAINT [ReturnRequest_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReturnItem] ADD CONSTRAINT [ReturnItem_returnRequestId_fkey] FOREIGN KEY ([returnRequestId]) REFERENCES [dbo].[ReturnRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReturnItem] ADD CONSTRAINT [ReturnItem_orderItemId_fkey] FOREIGN KEY ([orderItemId]) REFERENCES [dbo].[OrderItem]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ZonePincode] ADD CONSTRAINT [ZonePincode_zoneId_fkey] FOREIGN KEY ([zoneId]) REFERENCES [dbo].[ShippingZone]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
