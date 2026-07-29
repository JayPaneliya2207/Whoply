import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { shopkeeperDashboard } from '../../controllers/shopkeeper/dashboard.controller.js';
import { getMyBusiness, updateMyBusiness } from '../../controllers/shared/business.controller.js';
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
import { createSale, listInvoices, getInvoice, markBillSent, getEInvoiceJson, getEWayBillJson } from '../../controllers/shopkeeper/billing.controller.js';
import { createQuotation, listQuotations, getQuotation, deleteQuotation, convertQuotation } from '../../controllers/shopkeeper/quotation.controller.js';
import { createReturn, listReturns } from '../../controllers/shopkeeper/return.controller.js';
import {
    listCustomers,
    createCustomer,
    getCustomerLedger,
    recordRepayment,
} from '../../controllers/shopkeeper/customer.controller.js';
import {
    listSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    listPurchases,
    createPurchase,
    receivePurchase,
    payPurchase,
} from '../../controllers/shopkeeper/supplier.controller.js';
import { listExpenses, createExpense, updateExpense, deleteExpense } from '../../controllers/shopkeeper/expense.controller.js';
import { salesReport, productReport, profitReport, summaryReport, exportInvoicesCsv, dayCloseReport, gstReport } from '../../controllers/shopkeeper/report.controller.js';
import { aiReorder, listNotifications, markAllRead, markRead } from '../../controllers/shopkeeper/insights.controller.js';

const router = Router();

// All shopkeeper routes require an authenticated retail-side user
router.use(authenticate, requireRole('owner', 'manager', 'cashier'));

router.get('/dashboard', shopkeeperDashboard);

// Shop profile (name, GSTIN, address — shown on bills)
router.get('/business', getMyBusiness);
router.patch('/business', requireRole('owner', 'manager'), updateMyBusiness);

// Products & categories
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

// Billing (POS)
router.post('/billing', createSale);
router.get('/billing', listInvoices);
router.get('/billing/:id', getInvoice);
router.post('/billing/:id/mark-sent', markBillSent);
router.get('/billing/:id/einvoice', getEInvoiceJson);
router.post('/billing/:id/eway', getEWayBillJson);

// Quotations / estimates → convert to invoice
router.get('/quotations', listQuotations);
router.post('/quotations', createQuotation);
router.get('/quotations/:id', getQuotation);
router.delete('/quotations/:id', deleteQuotation);
router.post('/quotations/:id/convert', convertQuotation);

// Returns / credit notes
router.get('/returns', listReturns);
router.post('/returns', createReturn);

// Customers & udhar
router.get('/customers', listCustomers);
router.post('/customers', createCustomer);
router.get('/customers/:id/ledger', getCustomerLedger);
router.post('/customers/:id/repayment', recordRepayment);

// Suppliers & purchases
router.get('/suppliers', listSuppliers);
router.post('/suppliers', createSupplier);
router.patch('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);
router.get('/purchases', listPurchases);
router.post('/purchases', createPurchase);
router.post('/purchases/:id/receive', receivePurchase);
router.post('/purchases/:id/payment', payPurchase);

// Expenses
router.get('/expenses', listExpenses);
router.post('/expenses', createExpense);
router.patch('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

// Reports
router.get('/reports/sales', salesReport);
router.get('/reports/products', productReport);
router.get('/reports/profit', profitReport);
router.get('/reports/summary', summaryReport);
router.get('/reports/day-close', dayCloseReport);
router.get('/reports/export', exportInvoicesCsv);
router.get('/reports/gst', gstReport);

// AI insights + notifications
router.get('/ai/reorder', aiReorder);
router.get('/notifications', listNotifications);
router.post('/notifications/read-all', markAllRead);
router.post('/notifications/:id/read', markRead);

export default router;
