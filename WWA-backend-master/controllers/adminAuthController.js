const User = require('../model/User');
const bcrypt = require('bcrypt');
const adminMail = process.env.ADMIN_MAIL;



async function AdminSignupController(req, res) {

    const { firstname, lastname, email, password, cpassword } = req.body;

    if (!firstname || !lastname || !email || !password || !cpassword) {
        return res.status(422), res.json({ message: 'please fill all fields' });
    }

    if (password !== cpassword) {
        return res.status(422), res.json({ message: 'Passwords do not match' });
    }

    try {

        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400), res.json({ message: 'User already exists' });
        }

        // Create a new user instance
        const newUser = new User({ firstname, lastname, email, password });

        // Save the user to the database
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

async function AdminLoginController(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(422), res.json({ message: 'Please fill all fields' });
    }

    if (email != adminMail) {
        return res.status(400), res.json({ message: 'Invalid Credentials' });
    }

    try {

        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(400), res.json({ message: 'Invalid Credentials' });
        }

        const ismatch = await bcrypt.compare(password, user.password);

        if (!ismatch) {
            return res.status(400), res.json({ message: "Invalid Credentials" });
        }

        const token = await user.generateAuthToken();

        res.cookie('jwtoken', token, {
            expires: new Date(Date.now() + 258920000000),

        });
        res.status(200).json({ message: 'Login Succesful' });

    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }

}

function AdminLogoutController(req, res) {
    try {
        res.clearCookie('jwtoken');
        res.status(200).json({ message: 'Logout successful' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

async function AdminForgotController(req, res) {
    const { email, password, cpassword } = req.body;

    if (!email || !password || !cpassword) {
        return res.status(422), res.json({ message: 'Please fill all fields' });
    }

    if (password !== cpassword) {
        return res.status(422), res.json({ message: 'Passwords do not match' });
    }

    if (email != adminMail) {
        return res.status(400), res.json({ message: 'Admin Not Found' });
    }


    try {
        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(400), res.json({ message: 'Email not found' });
        }

        user.password = password;
        await user.save();
        res.status(200).json({ message: 'Password changed successfully' })

    }
    catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }

}

module.exports = { AdminSignupController, AdminLoginController, AdminLogoutController, AdminForgotController };