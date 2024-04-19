import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import User from '../models/user.js';
import UserForgotPassword from '../models/users_forgot_password.js';
import UserRefreshToken from '../models/user_refresh_token.js';
import { NextFunction ,Request, Response} from 'express';
import { sendEmail } from '../utils/sendgrid.js';
import CustomerCustomers from '../models/customer/customer_customers.js';

type JwtVerifyPayload = {
  email: string;
  sub: string;
	userId:string;
	userName:string;
};

dotenv.config();

// const generateRefreshToken = async (userId, email, userName) => {
//   try {
//     const expiresIn = dayjs().add(30, "day").unix();
//     const refreshToken = jwt.sign({ email, userId, userName }, process.env.JWT_REFRESH_TOKEN_SECRET, {
//         subject: userId.toString(),
//         expiresIn: '1d'
//     });

//     await UserRefreshToken.create({
//         user_id: userId,
//         expires_in: expiresIn,
//         refresh_token: refreshToken
//     });

//     return refreshToken;
//   } catch (error) {
//     console.error(error);
//     // throw new Error("Failed to generate refresh token");
//   }
// };

export const customerSignUp = (req, res, next) => {
	console.log(req);
	CustomerCustomers.findOne({ where : {
		email: req.body.email, 
	}})
	.then(dbCustomer => {
		if (dbCustomer) {
			return res.status(409).json({message: "This email already exists"});
		} else if (req.body.email && req.body.password) {
			// password hash
			bcrypt.hash(req.body.password, 12, (err, passwordHash) => {
				if (err) {
					return res.status(500).json({message: "couldnt hash the password"}); 
				} else if (passwordHash) {
					return CustomerCustomers.create(({
						email: req.body.email,
						first_name: req.body.first_name,
						last_name: req.body.last_name,
						phone_number: req.body.phone_number,
						home_address: req.body.home_address,
						address2: req.body.address2,
						city: req.body.city,
						state: req.body.state,
						zipcode: req.body.zipcode,
						password: passwordHash,
					}))
					.then((newUser) => {
				    const refreshToken = jwt.sign(
	    	    { 
			        email: newUser.email, 
			        id: newUser.id, 
			        name: newUser.first_name + ' ' + newUser.last_name 
				    }, 
			    	process.env.JWT_REFRESH_TOKEN_SECRET, 
			    	{
			        subject: newUser.id.toString(),
			        expiresIn: '1d'
				    });
						res.status(200).json({
							message: "customer account created",
							refreshToken,
							fullName: newUser.first_name + ' ' + newUser.last_name,
							customerId: newUser.id,
							...newUser
						});
					})
					.catch(err => {
						console.log(err);
						res.status(502).json({message: "error while creating the customer account"});
					});
				};
			});
		} else if (!req.body.password) {
			return res.status(400).json({message: "password not provided"});
		} else if (!req.body.email) {
			return res.status(400).json({message: "email not provided"});
		};
	})
	.catch(err => {
		console.log('error', err);
	});
};

export const getTestToken = async (req, res, next) => {
	return null;
	const testId = 999999;
	const testEmail = 'test@email.com';
	const testUser = 'testUser';

	// const refreshToken = await generateRefreshToken(testId, testEmail, testUser)
	const expiresIn = dayjs().add(30, "day").unix()
	const refreshToken = jwt.sign({ testEmail, testId, testUser }, process.env.JWT_REFRESH_TOKEN_SECRET, {
		 subject: testId.toString(),
		 expiresIn: '1d'
	});

	res.status(200).json({
		message: "user logged in", 
		refreshToken,
		userId: testId,
		email: testEmail,
		userName: testUser,
	});
};

export const customerLogin = (req, res, next) => {
	CustomerCustomers.findOne({ where : {
		email: req.body.email, 
	}})
	.then(dbCustomer => {
		if (!dbCustomer) {
			return res.status(404).json({message: "customer not found"});
		} else {
			bcrypt.compare(req.body.password, dbCustomer.password, async (err, compareRes) => {
				if (err) {
					res.status(502).json({message: "error while checking customer password"});
				} else if (compareRes) {				
					// await UserRefreshToken.destroy({
					// 	where: {
					// 		user_id: dbCustomer.id,
					// 	}
					// })

					// const refreshToken = await generateRefreshToken(dbCustomer.id, req.body.email)

					const expiresIn = dayjs().add(30, "day").unix();
			    const refreshToken = jwt.sign(
	    	    { 
			        email: dbCustomer.email, 
			        id: dbCustomer.id, 
			        name: dbCustomer.first_name + ' ' + dbCustomer.last_name 
				    }, 
			    	process.env.JWT_REFRESH_TOKEN_SECRET, 
			    	{
			        subject: dbCustomer.id.toString(),
			        expiresIn: '1d'
				    });

					res.status(200).json({
						message: "customer logged in", 
						refreshToken,
						fullName: dbCustomer.first_name + ' ' + dbCustomer.last_name,
						customerId: dbCustomer.id,
						...dbCustomer
					});
				} else {
					res.status(403).json({message: "invalid credentials"});
				};
			});
		};
	})
	.catch(err => {
		console.log(err);
		console.log('error', err);
	});
};

export const logout = (req, res, next) => {
	const token = req.headers.authorization;
	res.status(200).json({ message: 'success' });
};

export const resetPass = async (req, res, next) => {
	try {
	  const dbUser = await User.findOne({ where: { email: req.body.email } });
	  if (!dbUser) {
		return res.status(404).json({ message: "User not found" });
	  } else {
		const id = uuidv4();
  
		const verifyLink = `${process.env.BASE_URL}/changepass/${id}`;
		const clientDirection = `${req.body.clientHost}/changepass/${id}`;

		const currentDate = new Date();
		currentDate.setMinutes(currentDate.getMinutes() + 15);
		const formattedExpireDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

		UserForgotPassword.create({
			user_id: dbUser.id,
			recover_id: id,
			client_direction: clientDirection,
			expire_date: formattedExpireDate,
		}, {
			fields: ['user_id', 'recover_id', 'client_direction', 'expire_date']
		});


		const msg = {
		  to: dbUser.email,
		  dynamic_template_data: {
				subject: 'Reset Your Password',
				name: dbUser.name,
				link: verifyLink,
		  },
		};
		await sendEmail(msg);
		return res.status(200).json({ message: "Reset password link is sent. Please check your email" });
	  }
	} catch (err) {
	  console.error('An error occurred:', err);
	  return res.status(500).send("An error occurred");
	}
};

export const verifyChangePass = (req, res, next) => {
	const recoveryId = req.params.id;
	const currentDate = new Date();
	UserForgotPassword.findOne({
		where: {
			recover_id: recoveryId
		}
	}).then((result) => {
		if (result) {
			const expireDate = new Date(result.expire_date);
			if (result.is_expired == 1 || expireDate < currentDate) {
				res.status(400).json({ error: "The link is expired" });
			} else {
				res.redirect(result.client_direction);
			}
		} else {
			res.status(404).json({ error: "Record not found" });
		}
	}).catch((error) => {
		console.error(error);
		res.status(500).json({ error: "Internal server error" });
	});
};

export const newPass = (req, res, next) => {
	const currentDate = new Date();
	UserForgotPassword.findOne({
		where: {
			recover_id: req.body.recoveryId
		}
	}).then((result) => {
		if (result) {
			const expireDate = new Date(result.expire_date);
			if (result.is_expired == 1 || expireDate < currentDate) {
				res.status(400).json({ error: "The link is expired" });
			} else {
				bcrypt.hash(req.body.password, 12, (err, passwordHash) => {
					if (passwordHash) {
						User.update(
						  { password: passwordHash },
						  { where: { id: result.user_id } }
						).then((result) => {
							UserForgotPassword.update(
								{ is_expired: 1 },
								{ where: { recover_id: req.body.recoveryId } }
							)
							res.status(200).json({ error: "Password updated successfully" });
						}).catch((error) => {
							res.status(500).json({ error: "Internal server error" });
						});
					};
				});
			}
		} else {
			res.status(404).json({ error: "Record not found" });
		}
	}).catch((error) => {
		console.error(error);
		res.status(500).json({ error: "Internal server error" });
	});
};

export const isAuth = (req, res, next) => {
	const authHeader = req.get("Authorization");
	if (!authHeader) {
		return res.status(401).json({ message: 'not authenticated' });
	};
	const token = authHeader.split(' ')[1];
	let decodedToken; 
	try {
		decodedToken = jwt.verify(token, 'secret');
	} catch (err) {
		return res.status(500).json({ message: err.message || 'could not decode the token' });
	};
	if (!decodedToken) {
		res.status(401).json({ message: 'unauthorized' });
	} else {
		res.status(200).json({ message: 'here is your resource' });
	};
};

export const refreshToken = async (req:Request, res:Response, next:NextFunction)=>{
	const refreshToken = req.body.refresh_token

	const findRefreshToken = await UserRefreshToken.findOne({
		where: {
			refresh_token: refreshToken
		}
	})

	if(!findRefreshToken) { 
		return res.status(401).send({message: "Refresh token invalid."})
	}

	const { email, sub} = jwt.verify(
		refreshToken,
		process.env.JWT_REFRESH_TOKEN_SECRET
	) as JwtVerifyPayload;

	const refreshTokenExpired = dayjs().isAfter(dayjs.unix(findRefreshToken?.expires_in))

	if(refreshTokenExpired){
		await UserRefreshToken.destroy({
			where: {
				user_id : sub
			}
		})
		const newRefreshToken = await generateRefreshToken(sub,email)
		return res.send({refreshToken:newRefreshToken})
	}

	return res.status(401).send({})
}