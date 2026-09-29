import { Response } from "express";
import { AvatarUploadDto, PasswordDto, PayoutAccountDto } from "../settings-payment.dto";
import { AuthService } from "../security/auth.service";
import { AccountSettingsService } from "../services/account-settings.service";
export declare class AccountSettingsController {
    private readonly auth;
    private readonly account;
    constructor(auth: AuthService, account: AccountSettingsService);
    settings(authorization?: string): Promise<any>;
    avatar(dto: AvatarUploadDto, authorization?: string): Promise<{
        avatar_url: string;
    }>;
    createPayout(dto: PayoutAccountDto, authorization?: string): Promise<{
        account: {
            accountNumber: string | null;
            walletId: string | null;
            label: string;
            id: string;
            userId: string;
            method: PayoutMethod;
            bankName: string | null;
            accountName: string;
            branch: string | null;
            walletType: string | null;
            isDefault: boolean;
            status: string;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    updatePayout(id: string, dto: Partial<PayoutAccountDto>, authorization?: string): Promise<{
        account: {
            accountNumber: string | null;
            walletId: string | null;
            label: string;
            id: string;
            userId: string;
            method: PayoutMethod;
            bankName: string | null;
            accountName: string;
            branch: string | null;
            walletType: string | null;
            isDefault: boolean;
            status: string;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    makeDefault(id: string, authorization?: string): Promise<{
        account: {
            accountNumber: string | null;
            walletId: string | null;
            label: string;
            id: string;
            userId: string;
            method: PayoutMethod;
            bankName: string | null;
            accountName: string;
            branch: string | null;
            walletType: string | null;
            isDefault: boolean;
            status: string;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    reveal(id: string, dto: PasswordDto, authorization?: string): Promise<{
        account: any;
    }>;
    remove(id: string, authorization?: string, res?: Response): Promise<{
        account: {
            accountNumber: string | null;
            walletId: string | null;
            label: string;
            id: string;
            userId: string;
            method: PayoutMethod;
            bankName: string | null;
            accountName: string;
            branch: string | null;
            walletType: string | null;
            isDefault: boolean;
            status: string;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    private session;
}
