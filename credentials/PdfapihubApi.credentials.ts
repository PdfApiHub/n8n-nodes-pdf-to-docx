import {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PdfapihubApi implements ICredentialType {
	name = 'pdfapihubApi';
	displayName = 'PDF API Hub API';
	documentationUrl = 'https://pdfapihub.com/docs';
	icon: Icon = {
		light: 'file:../icons/icon.svg',
		dark: 'file:../icons/icon.svg'
	};
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { 'CLIENT-API-KEY': '={{$credentials.apiKey}}' },
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://pdfapihub.com',
			url: '/api/v1/pdf/merge',
			method: 'POST',
			headers: {
				'CLIENT-API-KEY': '={{$credentials.apiKey}}',
				'Content-Type': 'application/json',
			},
			body: {
				urls: ['https://pdfapihub.com/sample1.pdf', 'https://pdfapihub.com/sample1.pdf'],
				output: 'url',
			},
		},
	};
}
