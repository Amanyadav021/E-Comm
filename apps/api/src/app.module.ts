import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Core
import { PrismaService } from './prisma/prisma.service';
import { AuditService } from './common/audit.service';

// Auth
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard, PermissionsGuard, RolePermissionResolver } from './auth/guards';
import { OTP_SENDER, otpSenderFactory } from './auth/otp.provider';

// Customer-facing
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { ContentController } from './content/content.controller';
import { CartController } from './cart/cart.controller';
import { CartService } from './cart/cart.service';
import { WishlistController } from './wishlist/wishlist.controller';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { CheckoutService } from './checkout/checkout.service';
import { ReviewsController } from './reviews/reviews.controller';

// Payments & inventory
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { PAYMENT_GATEWAY, paymentGatewayFactory } from './payments/gateway';
import { PricingService } from './pricing/pricing.service';
import { InventoryService } from './inventory/inventory.service';

// Notifications
import { NotificationsService } from './notifications/notifications.service';
import { EMAIL_SENDER, emailSenderFactory } from './notifications/email.provider';

// Admin
import { CatalogAdminController } from './admin/catalog-admin.controller';
import { CatalogAdminService } from './admin/catalog-admin.service';
import { OrdersAdminController } from './admin/orders-admin.controller';
import { OrdersAdminService } from './admin/orders-admin.service';
import { InventoryAdminController } from './admin/inventory-admin.controller';
import { CustomersAdminController } from './admin/customers-admin.controller';
import { PaymentsAdminController } from './admin/payments-admin.controller';
import { MarketingAdminController } from './admin/marketing-admin.controller';
import { ReviewsAdminController } from './admin/reviews-admin.controller';
import { ShippingAdminController } from './admin/shipping-admin.controller';
import { NotificationsAdminController, AuditAdminController } from './admin/notifications-admin.controller';
import { ReportsAdminController } from './admin/reports-admin.controller';
import { SettingsAdminController } from './admin/settings-admin.controller';

// Misc
import { UploadsController } from './uploads/uploads.controller';
import { STORAGE_PROVIDER, storageProviderFactory } from './uploads/storage.provider';
import { TasksService } from './tasks/tasks.service';

/**
 * ShopCraft API — a modular monolith. Each domain lives in its own folder
 * (auth, catalog, cart, checkout, payments, orders, inventory, admin/*) with
 * services as the domain boundary; this module wires the dependency graph.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
  ],
  controllers: [
    AuthController,
    UsersController,
    CatalogController,
    ContentController,
    CartController,
    WishlistController,
    OrdersController,
    ReviewsController,
    PaymentsController,
    UploadsController,
    CatalogAdminController,
    OrdersAdminController,
    InventoryAdminController,
    CustomersAdminController,
    PaymentsAdminController,
    MarketingAdminController,
    ReviewsAdminController,
    ShippingAdminController,
    NotificationsAdminController,
    AuditAdminController,
    ReportsAdminController,
    SettingsAdminController,
  ],
  providers: [
    PrismaService,
    AuditService,
    AuthService,
    RolePermissionResolver,
    UsersService,
    CatalogService,
    CartService,
    OrdersService,
    CheckoutService,
    PaymentsService,
    PricingService,
    InventoryService,
    NotificationsService,
    CatalogAdminService,
    OrdersAdminService,
    TasksService,
    { provide: OTP_SENDER, useFactory: otpSenderFactory },
    { provide: EMAIL_SENDER, useFactory: emailSenderFactory },
    { provide: PAYMENT_GATEWAY, useFactory: paymentGatewayFactory },
    { provide: STORAGE_PROVIDER, useFactory: storageProviderFactory },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
