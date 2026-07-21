import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { wholesalerDashboard } from '../../controllers/wholesaler/dashboard.controller.js';
import {
    listDealers,
    createDealer,
    updateDealer,
    deleteDealer,
    dealerOrders,
    collectPayment,
} from '../../controllers/wholesaler/dealer.controller.js';
import { createOrder, listOrders, updateOrderStatus } from '../../controllers/wholesaler/order.controller.js';
import { getPriceList, setPrice } from '../../controllers/wholesaler/priceList.controller.js';
import {
    listReps,
    createRep,
    updateRep,
    deleteRep,
    listVisits,
    recordVisit,
} from '../../controllers/wholesaler/salesTeam.controller.js';
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

export default router;
