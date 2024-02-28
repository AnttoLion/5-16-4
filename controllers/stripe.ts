import { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();

import Stripe from 'stripe';
// const stripe = new Stripe('sk_test_4eC39HqLyjWDarjtT1zdp7dc');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCustomerStripe = async (req, res, next) => {
  try {
    const customer = await stripe.customers.create({
      email: req.body.email,
      name: req.body.name,
      description: req.body.description,
      phone: req.body.phone,
      address: {
        line1: req.body.addressLine1,
        line2: req.body.addressLine2,
        city: req.body.city,
        state: req.body.state,
        postal_code: req.body.postalCode,
        country: req.body.country
      }
    });

    res.json(customer);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export const retriveCustomerStripe = async (req, res, next) => {
  try {
    const customer = await stripe.customers.retrieve(req.body.customerId);

    res.json(customer);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export const createCardToCustomer = async (req, res, next) => {
  try {
    // const paymentMethod = await stripe.paymentMethods.create({
    //   type: "card",
    //   card: {
    //     number: req.body.number,
    //     exp_month: req.body.expMonth,
    //     exp_year: req.body.expYear,
    //     cvc: req.body.cvc,
    //   }
    // });
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: "4242424242424242",
        exp_month: 12,
        exp_year: 2024,
        cvc: 123,
      }
    });
    // const paymentMethod = await stripe.paymentMethods.create({
    //   type: "card",
    //   card: {
    //     number: "4213550150474327",
    //     exp_month: 04,
    //     exp_year: 2028,
    //     cvc: 490,
    //   }
    // });

    const customerId = "cus_PZX06ma31tIVTO";
    await stripe.paymentMethods.attach('pm_1OkW1nERU8T0qKkfLZlclCuM', {
      customer: customerId
    });

    res.json(paymentMethod);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export const addAndSaveCard = async (req, res, next) => {
  try {
    const customerId = "cus_PZX06ma31tIVTO";

    const cardToken = await stripe.tokens.create({
      card: {
        number: '5555555555554444',
        exp_month: 12,
        exp_year: 2023,
        cvc: 111,
      }
    });

    const card = await stripe.customers.createSource(customerId, {
      source: cardToken.id
    })

    res.json(card);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export const addCardTokenToCustomer = async (req, res, next) => {
  try {
    const customerId = req.body.customerId;

    const card = await stripe.customers.createSource(customerId, {
      source: req.body.cardToken
    })

    res.json(card);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export const makePayment = async (req, res, next) => {
  console.log(req.body);
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: req.body.currency,
      payment_method: req.body.paymentMethod,
      confirm: true,
      customer: req.body.customer,
      automatic_payment_methods:{
        enabled: true,
        allow_redirects: 'never'
      },
      return_url: "http://localhost:300/success"
    });

    res.json(paymentIntent)
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export const detachCardTokenToCustomer = async (req, res, next) => {
  try {
    const customerId = req.body.customerId;

    const customerSource = await stripe.customers.deleteSource(
      customerId,
      req.body.cardToken
    );

    res.json(customerSource);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export const addPaymentMethodToCustomer = async (req, res, next) => {
  try {
    const result = await stripe.paymentMethods.attach(req.body.paymentId, {
      customer: req.body.customerId
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}

export const listPaymentMethods = async (req, res, next) => {
  try {
    const customerId = req.body.customerId;

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card"
    });

    const formattedPaymentMethods = paymentMethods.data.map(method => {
      return {
        id: method.id,
        brand: method.card.brand,
        last4: method.card.last4,
        expiration: `${('0' + method.card.exp_month).slice(-2)}/${String(method.card.exp_year).slice(-2)}`
      };
    });

    res.json(formattedPaymentMethods);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
}