import { TEST_CONFIG } from '../setup';

export interface EdgeFunctionResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Check if an edge function is available (deployed)
 */
export async function isEdgeFunctionAvailable(functionName: string): Promise<boolean> {
  try {
    const response = await fetch(`${TEST_CONFIG.EDGE_FUNCTION_BASE_URL}/${functionName}`, {
      method: 'OPTIONS',
    });
    return response.status !== 404;
  } catch {
    return false;
  }
}

/**
 * Call a Supabase Edge Function with authentication
 */
export async function callEdgeFunction<T = any>(
  functionName: string,
  body: any,
  accessToken?: string
): Promise<EdgeFunctionResponse<T>> {
  const url = `${TEST_CONFIG.EDGE_FUNCTION_BASE_URL}/${functionName}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      return {
        status: response.status,
        error: data.error || data.message || text,
        message: data.message,
      };
    }

    return {
      status: response.status,
      data,
      message: data.message,
    };
  } catch (error: any) {
    return {
      status: 500,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Call issue_license Edge Function
 */
export async function callIssueLicense(
  accessToken: string,
  params: {
    product: string;
    plan: string;
    features: any;
    device_fingerprint: string;
    expires_in_days: number;
  }
) {
  return callEdgeFunction('issue_license', params, accessToken);
}

/**
 * Call validate_license Edge Function
 */
export async function callValidateLicense(params: {
  license_jwt: string;
  device_fingerprint: string;
}, accessToken?: string) {
  return callEdgeFunction('validate_license', params, accessToken);
}

/**
 * Call revoke_license Edge Function
 */
export async function callRevokeLicense(
  accessToken: string,
  params: {
    license_id: string;
    reason?: string;
  }
) {
  return callEdgeFunction('revoke_license', params, accessToken);
}

/**
 * Call register_device Edge Function
 */
export async function callRegisterDevice(
  accessToken: string,
  params: {
    fingerprint: string;
    name?: string;
  }
) {
  return callEdgeFunction('register_device', params, accessToken);
}

/**
 * Call stripe_webhook Edge Function
 */
export async function callStripeWebhook(params: {
  type: string;
  data: any;
  signature?: string;
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (params.signature) {
    headers['stripe-signature'] = params.signature;
  }

  const url = `${TEST_CONFIG.EDGE_FUNCTION_BASE_URL}/stripe_webhook`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: params.type,
        object: params.data,
      }),
    });

    const text = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    return {
      status: response.status,
      data,
      error: !response.ok ? (data.error || data.message || text) : undefined,
    };
  } catch (error: any) {
    return {
      status: 500,
      error: error.message || 'Network error',
    };
  }
}

