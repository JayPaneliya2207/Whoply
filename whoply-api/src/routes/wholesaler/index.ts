import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole, requirePerm as p } from '../../middleware/role.middleware.js';
import { wholesalerDashboard } from '../../controllers/wholesaler/dashboard.controller.js';
import { getMyBusiness, updateMyBusiness } from '../../controllers/shared/business.controller.js';
import {
    listDealers,
    createDealer,
    updateDealer,
    deleteDealer,
    dealerOrders,
    collectPayment,
} from '../../controllers/wholesaler/dealer.controller.js';
import { createOrder, listOrders, updateOrderStatus, updateOrderItems, orderEInvoiceJson, orderEWayJson, wholesalerGstReport, createOrderReturn, listOrderReturns } from '../../controllers/wholesaler/order.controller.js';
import { recordOrderPayment, listPayments, tallyReport } from '../../controllers/wholesaler/payment.controller.js';
import { createWsQuote, listWsQuotes, deleteWsQuote, convertWsQuote } from '../../controllers/wholesaler/quotation.controller.js';
import { getPriceList, setPrice } from '../../controllers/wholesaler/pricelist.controller.js';
import {
    listReps,
    createRep,
    updateRep,
    deleteRep,
    listVisits,
    recordVisit,
} from '../../controllers/wholesaler/salesTeam.controller.js';
// Notifications are business-scoped & role-agnostic — reuse the shopkeeper insights controller.
import { listNotifications, markAllRead, markRead } from '../../controllers/shopkeeper/insights.controller.js';
// Product & category CRUD is identical logic — reuse the shopkeeper controller (scoped by business).
import {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    productMovements,
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../../controllers/shopkeeper/product.controller.js';

const router = Router();
// Each route then checks that the role has the permission (utils/permissions.ts).
router.use(authenticate, requireRole('owner', 'manager', 'warehouse', 'salesStaff', 'accountant'));

router.get('/dashboard', wholesalerDashboard);

// Business profile (name, GSTIN, address — shown on invoices)
router.get('/business', getMyBusiness);
router.patch('/business', p('business.edit'), updateMyBusiness);

// Warehouse stock — full product & category CRUD
router.get('/products', p('products.view'), listProducts);
router.post('/products', p('products.manage'), createProduct);
router.get('/products/:id', p('products.view'), getProduct);
router.patch('/products/:id', p('products.manage'), updateProduct);
router.delete('/products/:id', p('products.manage'), deleteProduct);
router.post('/products/:id/adjust-stock', p('products.manage'), adjustStock);
router.get('/products/:id/movements', p('products.view'), productMovements);
router.get('/categories', p('products.view'), listCategories);
router.post('/categories', p('products.manage'), createCategory);
router.patch('/categories/:id', p('products.manage'), updateCategory);
router.delete('/categories/:id', p('products.manage'), deleteCategory);

// Dealers
router.get('/dealers', p('dealers.view'), listDealers);
router.post('/dealers', p('dealers.manage'), createDealer);
router.patch('/dealers/:id', p('dealers.manage'), updateDealer);
router.delete('/dealers/:id', p('dealers.delete'), deleteDealer);
router.get('/dealers/:id/orders', p('dealers.view'), dealerOrders);
router.post('/dealers/:id/collect', p('payments.collect'), collectPayment);

// Orders + dispatch/delivery
router.get('/orders', p('orders.view'), listOrders);
router.post('/orders', p('orders.create'), createOrder);
router.patch('/orders/:id', p('orders.create'), updateOrderItems);
router.patch('/orders/:id/status', p('orders.status'), updateOrderStatus);
router.post('/orders/:id/collect', p('payments.collect'), recordOrderPayment);
router.get('/orders/:id/einvoice', p('einvoice'), orderEInvoiceJson);
router.post('/orders/:id/eway', p('einvoice'), orderEWayJson);
router.post('/orders/:id/return', p('returns.create'), createOrderReturn);
router.get('/returns', p('returns.view'), listOrderReturns);

// Payments (money-in ledger) + account tally + GST returns
router.get('/payments', p('payments.view'), listPayments);
router.get('/reports/tally', p('reports.view'), tallyReport);
router.get('/reports/gst', p('gst.view'), wholesalerGstReport);

// Quotations (dealer estimates) → convert to order
router.get('/quotations', p('quotations'), listWsQuotes);
router.post('/quotations', p('quotations'), createWsQuote);
router.delete('/quotations/:id', p('quotations'), deleteWsQuote);
router.post('/quotations/:id/convert', p('quotations'), p('orders.create'), convertWsQuote);

// Price lists
router.get('/price-lists', p('priceList.view'), getPriceList);
router.put('/price-lists', p('priceList.manage'), setPrice);

// Sales team
router.get('/sales-team', p('team.view'), listReps);
router.post('/sales-team', p('staff.manage'), createRep);
router.patch('/sales-team/:id', p('staff.manage'), updateRep);
router.delete('/sales-team/:id', p('staff.manage'), deleteRep);
router.get('/sales-team/visits', p('team.view', 'visits.record'), listVisits);
router.post('/sales-team/visits', p('visits.record'), recordVisit);

// Notifications
router.get('/notifications', listNotifications);
router.post('/notifications/read-all', markAllRead);
router.post('/notifications/:id/read', markRead);

export default router;
