import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export function checkApiResponse(
	context: IExecuteFunctions,
	statusCode: number,
	responseBody: unknown,
	itemIndex: number,
): void {
	if (statusCode >= 200 && statusCode < 300) return;
	let apiMessage = `API request failed with status ${statusCode}`;
	let bodyObj: Record<string, unknown> = {};
	if (responseBody && typeof responseBody === 'object') {
		bodyObj = responseBody as Record<string, unknown>;
		if (typeof bodyObj.error === 'string') apiMessage = bodyObj.error;
	} else if (typeof responseBody === 'string') {
		try {
			const parsed = JSON.parse(responseBody) as Record<string, unknown>;
			if (typeof parsed.error === 'string') { apiMessage = parsed.error; bodyObj = parsed; }
		} catch { /* not JSON */ }
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	throw new NodeApiError(context.getNode(), bodyObj as any, { message: apiMessage, httpCode: String(statusCode), itemIndex });
}

export function normalizeUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return trimmed;
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
	return `https://${trimmed}`;
}

export async function prepareBinaryResponse(
	this: IExecuteFunctions,
	itemIndex: number,
	responseData: { body: ArrayBuffer; headers?: Record<string, unknown> },
	fallbackFileName: string,
	fallbackMimeType: string,
): Promise<INodeExecutionData> {
	const headers = responseData.headers ?? {};
	const contentTypeHeader =
		(typeof headers['content-type'] === 'string' ? headers['content-type'] : undefined) ??
		(typeof headers['Content-Type'] === 'string' ? headers['Content-Type'] : undefined);
	const contentType = contentTypeHeader?.split(';')[0]?.trim() || fallbackMimeType;
	let fileName = fallbackFileName;
	if (!fileName) fileName = 'output';
	if (!fileName.includes('.') && contentType.includes('/')) {
		const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('zip') ? 'zip' : 'bin';
		fileName = `${fileName}.${ext}`;
	}
	const binaryData = await this.helpers.prepareBinaryData(Buffer.from(responseData.body), fileName, contentType);
	return { json: { success: true }, binary: { data: binaryData }, pairedItem: { item: itemIndex } };
}

export async function createSingleFileMultipart(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryPropertyName: string,
	fields: Record<string, string | number | boolean>,
) {
	const boundary = `----n8nFormBoundary${Math.random().toString(36).slice(2)}`;
	const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const fileName = binaryData.fileName ?? 'file.pdf';
	const contentType = binaryData.mimeType ?? 'application/pdf';
	const parts: Buffer[] = [];
	parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`));
	parts.push(Buffer.from(binaryDataBuffer));
	parts.push(Buffer.from('\r\n'));
	for (const [key, value] of Object.entries(fields)) {
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${String(value)}\r\n`));
	}
	parts.push(Buffer.from(`--${boundary}--\r\n`));
	return { body: Buffer.concat(parts), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

export async function createTwoFileMultipart(
	this: IExecuteFunctions,
	itemIndex: number,
	file1BinaryProperty: string,
	file2BinaryProperty: string,
	method: string,
) {
	const boundary = `----n8nFormBoundary${Math.random().toString(36).slice(2)}`;
	const parts: Buffer[] = [];
	const appendFile = async (fieldName: 'file1' | 'file2', binaryPropertyName: string) => {
		const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
		const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
		const fileName = binaryData.fileName ?? `${fieldName}.bin`;
		const contentType = binaryData.mimeType ?? 'application/octet-stream';
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`));
		parts.push(Buffer.from(binaryDataBuffer));
		parts.push(Buffer.from('\r\n'));
	};
	await appendFile('file1', file1BinaryProperty);
	await appendFile('file2', file2BinaryProperty);
	if (method) {
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="method"\r\n\r\n${method}\r\n`));
	}
	parts.push(Buffer.from(`--${boundary}--\r\n`));
	return { body: Buffer.concat(parts), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

export function parseJsonResponseBody(body: unknown, itemIndex: number): INodeExecutionData {
	let json: IDataObject;
	if (typeof body === 'string') {
		try { json = JSON.parse(body) as IDataObject; } catch { json = { raw: body }; }
	} else {
		json = (body ?? {}) as IDataObject;
	}
	return { json, pairedItem: { item: itemIndex } };
}
