import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { orderStatusUpdateSchema, refundInputSchema } from '@shopcraft/shared';
import { validate } from '../common/utils';
import { OrdersAdminService } from './orders-admin.service';
import { RequirePerms, CurrentUser, AuthUser } from '../auth/decorators';

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const noteSchema = z.object({ note: z.string().max(4000) });

const returnUpdateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'RECEIVED', 'REFUND_PROCESSING', 'COMPLETED']),
  adminComment: z.string().max(1000).optional(),
  refundAmount: z.number().positive().optional(),
});

const returnListSchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

@Controller('admin/orders')
export class OrdersAdminController {
  constructor(private readonly svc: OrdersAdminService) {}

  @RequirePerms('orders.read')
  @Get()
  list(@Query() query: unknown) {
    return this.svc.list(validate(listSchema, query));
  }

  @RequirePerms('orders.read')
  @Get('returns')
  returns(@Query() query: unknown) {
    const dto = validate(returnListSchema, query);
    return this.svc.listReturns(dto.status, dto.page, dto.pageSize);
  }

  @RequirePerms('orders.read')
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="orders.csv"')
  export(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.exportCsv(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @RequirePerms('orders.read')
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(id);
  }

  @RequirePerms('orders.write')
  @Patch(':id/status')
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.updateStatus(id, validate(orderStatusUpdateSchema, body), user.id);
  }

  @RequirePerms('orders.write')
  @Patch(':id/note')
  note(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = validate(noteSchema, body);
    return this.svc.setAdminNote(id, dto.note, user.id);
  }

  @RequirePerms('refunds.write')
  @HttpCode(201)
  @Post(':id/refund')
  refund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.refund(id, validate(refundInputSchema, body), user.id);
  }

  @RequirePerms('orders.write')
  @Patch('returns/:id')
  updateReturn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.updateReturn(id, validate(returnUpdateSchema, body), user.id);
  }
}
