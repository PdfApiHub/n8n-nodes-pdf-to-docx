import type { IExecuteFunctions, INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { normalizeUrl, prepareBinaryResponse, createSingleFileMultipart, parseJsonResponseBody, checkApiResponse } from '../helpers';


export const description: INodeProperties[] = [
{
		displayName: 'Input Type',
		name: 'pdf2docx_input_type',
		type: 'options',
		options: [
			{ name: 'URL (Hosted Link) (Default)', value: 'url', description: 'Returns a downloadable URL — file hosted for 30 days' },
			{ name: 'Base64 (Inline Data)', value: 'base64', description: 'Returns base64-encoded data inside JSON' },
			{ name: 'File (Binary)', value: 'file' },
		],
		default: 'url',
		description: 'How to provide the source PDF for conversion to DOCX',
		displayOptions: {
			show: {
				operation: ['pdfToDocx'],
			},
		},
	},
{
		displayName: 'PDF URL',
		name: 'pdf2docx_url',
		type: 'string',
		default: '',
		description: 'Public URL of the PDF file to convert to DOCX',
		placeholder: 'https://pdfapihub.com/sample.pdf',
		displayOptions: {
			show: {
				operation: ['pdfToDocx'],
				pdf2docx_input_type: ['url'],
			},
		},
	},
{
		displayName: 'Base64 PDF',
		name: 'pdf2docx_base64_file',
		type: 'string',
		default: '',
		description: 'Base64-encoded content of the source PDF',
		displayOptions: {
			show: {
				operation: ['pdfToDocx'],
				pdf2docx_input_type: ['base64'],
			},
		},
	},
{
		displayName: 'Binary Property Name',
		name: 'pdf2docx_file_binary_property',
		type: 'string',
		default: 'data',
		description: 'Name of the binary property containing the PDF file to convert',
		displayOptions: {
			show: {
				operation: ['pdfToDocx'],
				pdf2docx_input_type: ['file'],
			},
		},
	},
{
		displayName: 'Pages',
		name: 'pdf2docx_pages',
		type: 'string',
		default: '',
		description: 'Page(s) to convert — single number like "1", range like "1-3", or comma-separated list like "1-3,5". Leave empty to convert all pages.',
		placeholder: '1-3,5',
		displayOptions: {
			show: {
				operation: ['pdfToDocx'],
			},
		},
	},
{
		displayName: 'Output Format',
		name: 'pdf2docx_output',
		type: 'options',
		options: [
			{ name: 'URL (Hosted Link) (Default)', value: 'url', description: 'Returns a downloadable URL — file hosted for 30 days' },
			{ name: 'Base64 (Inline Data)', value: 'base64', description: 'Returns base64-encoded data inside JSON' },
			{ name: 'Both (URL + Base64)', value: 'both', description: 'Returns both URL and base64 in one response' },
			{ name: 'Binary File (Download)', value: 'file', description: 'Returns raw binary — great for piping into other nodes' },
		],
		default: 'url',
		description: 'How the converted DOCX is returned',
		displayOptions: {
			show: {
				operation: ['pdfToDocx'],
			},
		},
	},
{
		displayName: 'Output Filename',
		name: 'pdf2docx_output_filename',
		type: 'string',
		default: 'converted.docx',
		description: 'Filename for the output DOCX file',
		displayOptions: {
			show: {
				operation: ['pdfToDocx'],
			},
		},
	},
];

export async function execute(
	this: IExecuteFunctions,
	index: number,
	returnData: INodeExecutionData[],
): Promise<void> {
	const inputType = this.getNodeParameter('pdf2docx_input_type', index) as string;
	const outputFormat = this.getNodeParameter('pdf2docx_output', index) as string;
	const outputFilename = this.getNodeParameter('pdf2docx_output_filename', index) as string;
	const pages = (this.getNodeParameter('pdf2docx_pages', index, '') as string).trim();

	let requestOptions: Record<string, unknown>;

	if (inputType === 'file') {
		const fields: Record<string, string | number | boolean> = {
			output: outputFormat,
			output_filename: outputFilename,
		};
		if (pages) fields.pages = pages;

		requestOptions = await createSingleFileMultipart.call(
			this,
			index,
			this.getNodeParameter('pdf2docx_file_binary_property', index) as string,
			fields,
		);
	} else {
		const body: Record<string, unknown> = {
			output: outputFormat,
			output_filename: outputFilename,
		};

		if (inputType === 'url') {
			body.url = normalizeUrl(this.getNodeParameter('pdf2docx_url', index) as string);
		} else {
			body.file = this.getNodeParameter('pdf2docx_base64_file', index) as string;
		}

		if (pages) body.pages = pages;

		requestOptions = { body, json: true };
	}

	if (outputFormat === 'file') {
		const responseData = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'pdfapihubApi',
			{
				method: 'POST',
				url: 'https://pdfapihub.com/api/v1/convert/pdf/docx',
				...requestOptions,
				encoding: 'arraybuffer',
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
			},
		) as { body: ArrayBuffer; statusCode: number; headers?: Record<string, unknown> };

		if (responseData.statusCode >= 400) {
			let errorBody: unknown;
			try { errorBody = JSON.parse(Buffer.from(responseData.body).toString('utf8')); } catch { errorBody = {}; }
			checkApiResponse(this, responseData.statusCode, errorBody, index);
		}

		returnData.push(
			await prepareBinaryResponse.call(
				this,
				index,
				responseData,
				outputFilename || 'converted.docx',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			),
		);
	} else {
		const responseData = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'pdfapihubApi',
			{
				method: 'POST',
				url: 'https://pdfapihub.com/api/v1/convert/pdf/docx',
				...requestOptions,
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
			},
		) as { body: unknown; statusCode: number };

		checkApiResponse(this, responseData.statusCode, responseData.body, index);
		returnData.push(parseJsonResponseBody(responseData.body, index));
	}
}
