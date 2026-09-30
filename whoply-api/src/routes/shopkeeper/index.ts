import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole, requirePerm as p } from '../../middleware/role.middleware.js';
import { shopkeeperDashboard } from '../../controllers/shopkeeper/dashboard.controller.js';
import { getMyBusiness, updateMyBusiness } from '../../controllers/shared/business.controller.js';
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
import { createSale, listInvoices, getInvoice, markBillSent, getEInvoiceJson, getEWayBillJson } from '../../controllers/shopkeeper/billing.controller.js';
import { createQuotation, listQuotations, getQuotation, deleteQuotation, convertQuotation } from '../../controllers/shopkeeper/quotation.controller.js';
import { createReturn, listReturns } from '../../controllers/shopkeeper/return.controller.js';
import {
    listCustomers,
    createCustomer,
    getCustomerLedger,
    recordRepayment,
    updateCustomer,
    deleteCustomer,
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
    cancelPurchase,
} from '../../controllers/shopkeeper/supplier.controller.js';
import { listExpenses, createExpense, updateExpense, deleteExpense } from '../../controllers/shopkeeper/expense.controller.js';
import { salesReport, productReport, profitReport, summaryReport, exportInvoicesCsv, dayCloseReport, gstReport } from '../../controllers/shopkeeper/report.controller.js';
import { aiReorder, listNotifications, markAllRead, markRead } from '../../controllers/shopkeeper/insights.controller.js';

const router = Router();

// All shopkeeper routes require an authenticated retail-side user; each route then
// checks that the role has the permission (utils/permissions.ts).
router.use(authenticate, requireRole('owner', 'manager', 'cashier', 'accountant'));

router.get('/dashboard', shopkeeperDashboard);

// Shop profile (name, GSTIN, address — shown on bills)
router.get('/business', getMyBusiness);
router.patch('/business', p('business.edit'), updateMyBusiness);

// Products & categories
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

// Billing (POS)
router.post('/billing', p('billing.sell'), createSale);
router.get('/billing', p('bills.view'), listInvoices);
router.get('/billing/:id', p('bills.view'), getInvoice);
router.post('/billing/:id/mark-sent', p('bills.view'), markBillSent);
router.get('/billing/:id/einvoice', p('einvoice'), getEInvoiceJson);
router.post('/billing/:id/eway', p('einvoice'), getEWayBillJson);

// Quotations / estimates → convert to invoice
router.get('/quotations', p('quotations'), listQuotations);
router.post('/quotations', p('quotations'), createQuotation);
router.get('/quotations/:id', p('quotations'), getQuotation);
router.delete('/quotations/:id', p('quotations'), deleteQuotation);
router.post('/quotations/:id/convert', p('quotations'), p('billing.sell'), convertQuotation);

// Returns / credit notes
router.get('/returns', p('returns.view'), listReturns);
router.post('/returns', p('returns.create'), createReturn);

// Customers & udhar
router.get('/customers', p('customers.view'), listCustomers);
router.post('/customers', p('customers.manage'), createCustomer);
router.patch('/customers/:id', p('customers.manage'), updateCustomer);
router.delete('/customers/:id', p('customers.delete'), deleteCustomer);
router.get('/customers/:id/ledger', p('customers.view'), getCustomerLedger);
router.post('/customers/:id/repayment', p('customers.manage'), recordRepayment);

// Suppliers & purchases
router.get('/suppliers', p('purchases.view'), listSuppliers);
router.post('/suppliers', p('purchases.manage'), createSupplier);
router.patch('/suppliers/:id', p('purchases.manage'), updateSupplier);
router.delete('/suppliers/:id', p('purchases.manage'), deleteSupplier);
router.get('/purchases', p('purchases.view'), listPurchases);
router.post('/purchases', p('purchases.manage'), createPurchase);
router.post('/purchases/:id/receive', p('purchases.manage'), receivePurchase);
router.post('/purchases/:id/payment', p('purchases.manage'), payPurchase);
router.post('/purchases/:id/cancel', p('purchases.manage'), cancelPurchase);

// Expenses
router.get('/expenses', p('expenses.view'), listExpenses);
router.post('/expenses', p('expenses.manage'), createExpense);
router.patch('/expenses/:id', p('expenses.manage'), updateExpense);
router.delete('/expenses/:id', p('expenses.manage'), deleteExpense);

// Reports
router.get('/reports/sales', p('reports.view'), salesReport);
router.get('/reports/products', p('reports.view'), productReport);
router.get('/reports/profit', p('reports.view'), profitReport);
router.get('/reports/summary', p('reports.view'), summaryReport);
router.get('/reports/day-close', p('reports.dayClose'), dayCloseReport);
router.get('/reports/export', p('reports.view'), exportInvoicesCsv);
router.get('/reports/gst', p('gst.view'), gstReport);

// AI insights + notifications
router.get('/ai/reorder', p('insights'), aiReorder);
router.get('/notifications', listNotifications);
router.post('/notifications/read-all', markAllRead);
router.post('/notifications/:id/read', markRead);

export default router;
