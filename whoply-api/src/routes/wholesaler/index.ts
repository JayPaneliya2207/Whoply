import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
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
import { createOrder, listOrders, updateOrderStatus, orderEInvoiceJson, orderEWayJson, wholesalerGstReport, createOrderReturn, listOrderReturns } from '../../controllers/wholesaler/order.controller.js';
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
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../../controllers/shopkeeper/product.controller.js';

const router = Router();
router.use(authenticate, requireRole('owner', 'manager', 'warehouse', 'salesStaff'));

router.get('/dashboard', wholesalerDashboard);

// Business profile (name, GSTIN, address — shown on invoices)
router.get('/business', getMyBusiness);
router.patch('/business', requireRole('owner', 'manager'), updateMyBusiness);

// Warehouse stock — full product & category CRUD
router.get('/products', listProducts);
router.post('/products', createProduct);
router.get('/products/:id', getProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/adjust-stock', adjustStock);
router.get('/categories', listCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Dealers
router.get('/dealers', listDealers);
router.post('/dealers', createDealer);
router.patch('/dealers/:id', updateDealer);
router.delete('/dealers/:id', deleteDealer);
router.get('/dealers/:id/orders', dealerOrders);
router.post('/dealers/:id/collect', collectPayment);

// Orders + dispatch/delivery
router.get('/orders', listOrders);
router.post('/orders', createOrder);
router.patch('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/collect', recordOrderPayment);
router.get('/orders/:id/einvoice', orderEInvoiceJson);
router.post('/orders/:id/eway', orderEWayJson);
router.post('/orders/:id/return', createOrderReturn);
router.get('/returns', listOrderReturns);

// Payments (money-in ledger) + account tally + GST returns
router.get('/payments', listPayments);
router.get('/reports/tally', tallyReport);
router.get('/reports/gst', wholesalerGstReport);

// Quotations (dealer estimates) → convert to order
router.get('/quotations', listWsQuotes);
router.post('/quotations', createWsQuote);
router.delete('/quotations/:id', deleteWsQuote);
router.post('/quotations/:id/convert', convertWsQuote);

// Price lists
router.get('/price-lists', getPriceList);
router.put('/price-lists', setPrice);

// Sales team
router.get('/sales-team', listReps);
router.post('/sales-team', createRep);
router.patch('/sales-team/:id', updateRep);
router.delete('/sales-team/:id', deleteRep);
router.get('/sales-team/visits', listVisits);
router.post('/sales-team/visits', recordVisit);

// Notifications
router.get('/notifications', listNotifications);
router.post('/notifications/read-all', markAllRead);
router.post('/notifications/:id/read', markRead);

export default router;
