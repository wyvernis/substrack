const router = require('express').Router();
const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const SharedSubscription = require('../models/SharedSubscription');
const formatDoc = require('../utils/formatDoc');

const formatShared = (doc) => {
    const base = formatDoc(doc);
    if (doc.subscription_id && typeof doc.subscription_id === 'object') {
        base.subscription_name = doc.subscription_id.name;
        base.total_price = doc.subscription_id.amount;
        base.subscription_id = doc.subscription_id._id.toString();
    }
    return base;
};

router.get('/', auth, async (req, res) => {
    try {
        const userSubs = await Subscription.find({ user_id: req.user.id }).select('_id');
        const subIds = userSubs.map((s) => s._id);

        const shared = await SharedSubscription.find({ subscription_id: { $in: subIds } })
            .populate('subscription_id', 'name amount');

        res.json(shared.map(formatShared));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/', [
    auth,
    check('subscription_id', 'Subscription ID is required').not().isEmpty(),
    check('member_email', 'Member email is required').isEmail(),
    check('share_percentage', 'Share percentage is required').isNumeric(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
        }

        const { subscription_id, member_email, share_percentage } = req.body;

        if (!mongoose.Types.ObjectId.isValid(subscription_id)) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        const subscription = await Subscription.findOne({
            _id: subscription_id,
            user_id: req.user.id,
        });

        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        const shared = await SharedSubscription.create({
            subscription_id,
            shared_with_email: member_email,
            share_percentage,
        });

        await shared.populate('subscription_id', 'name amount');
        res.json(formatShared(shared));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'Shared subscription not found' });
        }

        const userSubs = await Subscription.find({ user_id: req.user.id }).select('_id');
        const subIds = userSubs.map((s) => s._id);

        const shared = await SharedSubscription.findOneAndDelete({
            _id: req.params.id,
            subscription_id: { $in: subIds },
        });

        if (!shared) {
            return res.status(404).json({ message: 'Shared subscription not found' });
        }

        res.json({ message: 'Shared subscription deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
