import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail, buildAccountPendingEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, firstName, lastName, gender, dob, country, currency, phone, password } = body;

        // Validation
        if (!email || !firstName || !lastName || !password) {
            return NextResponse.json(
                { message: 'Missing required configuration fields (email, name, password)' },
                { status: 400 }
            );
        }

        await dbConnect();

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { message: 'An account with this email already exists' },
                { status: 409 }
            );
        }

        // Create the user
        // WARNING: Password is saved in plain text per explicit user instruction.
        const withdrawalPin = Math.floor(1000 + Math.random() * 9000);

        const newUser = await User.create({
            email,
            firstName,
            lastName,
            gender,
            dob: new Date(dob),
            country,
            currency,
            phone,
            password,
            withdrawalPin,
            accountStatus: 'pending',
            // The rest of the custom dashboard fields drop to their Schema defaults (0, tier 1, etc)
        });

        // Send "account under review" email (non-blocking — don't fail registration if email fails)
        try {
            await sendEmail({
                to: email,
                subject: 'Musk Space — Your Account is Under Review',
                htmlbody: buildAccountPendingEmail(firstName),
            });
        } catch (emailError) {
            console.error('[Register] Failed to send pending email:', emailError);
        }

        return NextResponse.json(
            {
                message: 'Your account has been created and is pending admin approval.',
                userId: newUser._id,
                pendingApproval: true,
            },
            { status: 201 }
        );

    } catch (error: any) {
        console.error("Registration endpoint error:", error);
        return NextResponse.json(
            { message: 'An error occurred during registration', error: error.message },
            { status: 500 }
        );
    }
}
