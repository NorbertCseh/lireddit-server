import { UsernamePasswordInput } from "./UsernamePasswordInput"

export const validateRegister = (options: UsernamePasswordInput) => {
    if (options.username.length <= 2) {
        return [
            {
                field: 'username',
                message: 'Username must be greater than 2'
            }
        ]
    }

    if (options.username.includes('@')) {
        return [{
            field: 'username',
            message: 'Username cannot have "@" sign'
        }]

    }

    if (!options.email.includes('@')) {
        return [{
            field: 'email',
            message: 'Invalid email'
        }]

    }

    if (options.password.length <= 3) {
        return [{
            field: 'password',
            message: 'Password must be greater than 3'
        }]
    }
    return null;
}