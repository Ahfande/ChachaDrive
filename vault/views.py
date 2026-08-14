"""
vault/views.py
================
Mengelola file terenkripsi dengan Supabase Storage
"""

import os
import json
import base64
from datetime import datetime

from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from supabase import create_client

from accounts.decorators import api_login_required

# 🔥 SUPABASE CLIENT
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
SUPABASE_BUCKET = os.getenv('SUPABASE_BUCKET', 'cloud_storage')


def get_supabase_user_id(request):
    """Helper: Ambil user ID dari Supabase berdasarkan email dari Django"""
    email = request.user.email
    user_result = supabase.table('users').select('id').eq('email', email).execute()
    
    if not user_result.data:
        return None
    
    return user_result.data[0]['id']


@csrf_exempt
@api_login_required
@require_http_methods(['POST'])
def upload_view(request):
    """
    Upload file ke Supabase Storage
    """
    try:
        file_id = request.POST.get('id')
        original_name = request.POST.get('original_name')
        file_size = request.POST.get('file_size')
        file_ext = request.POST.get('file_ext', '')
        file_category = request.POST.get('file_category', '')
        mime_type = request.POST.get('mime_type', '')
        nonce = request.POST.get('nonce')
        
        ciphertext_file = request.FILES.get('ciphertext')
        if not ciphertext_file:
            return JsonResponse({'success': False, 'message': 'File tidak ditemukan'}, status=400)
        
        # 🔥 AMBIL USER ID DARI SUPABASE
        supabase_user_id = get_supabase_user_id(request)
        if not supabase_user_id:
            return JsonResponse({'success': False, 'message': 'User tidak ditemukan di Supabase'}, status=400)
        
        storage_path = f"user_{supabase_user_id}/{file_id}.enc"
        file_content = ciphertext_file.read()
        
        print(f"📤 Uploading file: {file_id}")
        print(f"   - supabase_user_id: {supabase_user_id}")
        print(f"   - storage_path: {storage_path}")
        
        # 🔥 Upload ke Storage
        result = supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=storage_path,
            file=file_content,
            file_options={
                "content-type": "application/octet-stream",
                "cache-control": "no-cache"
            }
        )
        print(f"✅ Storage upload result: {result}")
        
        # 🔥 Simpan metadata dengan user_id DARI SUPABASE
        metadata = {
            'id': file_id,
            'user_id': supabase_user_id,
            'original_name': original_name,
            'file_size': int(file_size),
            'file_ext': file_ext,
            'file_category': file_category,
            'mime_type': mime_type,
            'nonce': nonce,
            'storage_path': storage_path,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'is_deleted': False
        }
        
        result_meta = supabase.table('file_metadata').insert(metadata).execute()
        print(f"✅ Metadata saved: {result_meta}")
        
        return JsonResponse({
            'success': True,
            'message': 'File berhasil diupload',
            'data': {'id': file_id}
        })
        
    except Exception as e:
        print(f"❌ Upload error: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@api_login_required
@require_http_methods(['GET'])
def list_view(request):
    """List semua file milik user"""
    try:
        # 🔥 AMBIL USER ID DARI SUPABASE
        supabase_user_id = get_supabase_user_id(request)
        if not supabase_user_id:
            return JsonResponse({'success': True, 'data': [], 'count': 0})
        
        print(f"📋 List files for supabase_user_id: {supabase_user_id}")
        
        result = supabase.table('file_metadata')\
            .select('*')\
            .eq('user_id', supabase_user_id)\
            .eq('is_deleted', False)\
            .order('created_at', desc=True)\
            .execute()
        
        files = result.data if result.data else []
        print(f"📦 Found {len(files)} files")
        
        return JsonResponse({
            'success': True,
            'data': files,
            'count': len(files)
        })
        
    except Exception as e:
        print(f"❌ List error: {e}")
        return JsonResponse({'success': True, 'data': [], 'count': 0})


@api_login_required
@require_http_methods(['GET'])
def download_view(request, file_id):
    """Download file dari Supabase Storage"""
    try:
        # 🔥 AMBIL USER ID DARI SUPABASE
        supabase_user_id = get_supabase_user_id(request)
        if not supabase_user_id:
            return JsonResponse({'success': False, 'message': 'User tidak ditemukan'}, status=404)
        
        result = supabase.table('file_metadata')\
            .select('*')\
            .eq('id', file_id)\
            .eq('user_id', supabase_user_id)\
            .execute()
        
        if not result.data:
            return JsonResponse({'success': False, 'message': 'File tidak ditemukan'}, status=404)
        
        file_meta = result.data[0]
        storage_path = file_meta['storage_path']
        
        # 🔥 Download dari Supabase Storage
        response = supabase.storage.from_(SUPABASE_BUCKET).download(storage_path)
        
        # 🔥 Return file sebagai response
        http_response = HttpResponse(
            response,
            content_type='application/octet-stream'
        )
        http_response['Content-Disposition'] = f'attachment; filename="{file_meta["id"]}.enc"'
        http_response['X-Nonce'] = file_meta['nonce']
        http_response['X-Original-Name'] = file_meta['original_name']
        http_response['Access-Control-Expose-Headers'] = 'X-Nonce, X-Original-Name'
        
        return http_response
        
    except Exception as e:
        print(f"❌ Download error: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
@api_login_required
@require_http_methods(['DELETE'])
def delete_view(request, file_id):
    """Hapus file dari Supabase Storage dan metadata"""
    try:
        # 🔥 AMBIL USER ID DARI SUPABASE
        supabase_user_id = get_supabase_user_id(request)
        if not supabase_user_id:
            return JsonResponse({'success': False, 'message': 'User tidak ditemukan'}, status=404)
        
        result = supabase.table('file_metadata')\
            .select('*')\
            .eq('id', file_id)\
            .eq('user_id', supabase_user_id)\
            .execute()
        
        if not result.data:
            return JsonResponse({'success': False, 'message': 'File tidak ditemukan'}, status=404)
        
        file_meta = result.data[0]
        storage_path = file_meta['storage_path']
        
        # 🔥 Hapus dari Supabase Storage
        try:
            supabase.storage.from_(SUPABASE_BUCKET).remove([storage_path])
        except Exception as e:
            print(f"⚠️ Storage delete error (maybe already deleted): {e}")
        
        # 🔥 Soft delete metadata
        supabase.table('file_metadata')\
            .update({'is_deleted': True, 'updated_at': datetime.now().isoformat()})\
            .eq('id', file_id)\
            .execute()
        
        return JsonResponse({'success': True, 'message': 'File berhasil dihapus'})
        
    except Exception as e:
        print(f"❌ Delete error: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
@api_login_required
@require_http_methods(['PUT'])
def rename_view(request, file_id):
    """Rename file (update metadata saja)"""
    try:
        # 🔥 AMBIL USER ID DARI SUPABASE
        supabase_user_id = get_supabase_user_id(request)
        if not supabase_user_id:
            return JsonResponse({'success': False, 'message': 'User tidak ditemukan'}, status=404)
        
        data = json.loads(request.body)
        new_name = data.get('new_name', '').strip()
        
        if not new_name:
            return JsonResponse({'success': False, 'message': 'Nama tidak boleh kosong'}, status=400)
        
        # Update metadata
        supabase.table('file_metadata')\
            .update({
                'original_name': new_name,
                'updated_at': datetime.now().isoformat()
            })\
            .eq('id', file_id)\
            .eq('user_id', supabase_user_id)\
            .execute()
        
        return JsonResponse({'success': True, 'message': 'Nama berhasil diubah'})
        
    except Exception as e:
        print(f"❌ Rename error: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
@api_login_required
@require_http_methods(['PUT'])
def edit_view(request, file_id):
    """Edit file (update ciphertext)"""
    try:
        # 🔥 AMBIL USER ID DARI SUPABASE
        supabase_user_id = get_supabase_user_id(request)
        if not supabase_user_id:
            return JsonResponse({'success': False, 'message': 'User tidak ditemukan'}, status=404)
        
        data = json.loads(request.body)
        new_ciphertext_base64 = data.get('ciphertext')
        new_nonce = data.get('nonce')
        
        if not new_ciphertext_base64 or not new_nonce:
            return JsonResponse({'success': False, 'message': 'Data tidak lengkap'}, status=400)
        
        # Cari metadata
        result = supabase.table('file_metadata')\
            .select('*')\
            .eq('id', file_id)\
            .eq('user_id', supabase_user_id)\
            .execute()
        
        if not result.data:
            return JsonResponse({'success': False, 'message': 'File tidak ditemukan'}, status=404)
        
        file_meta = result.data[0]
        storage_path = file_meta['storage_path']
        
        # 🔥 Upload ulang ke Supabase Storage (overwrite)
        ciphertext_bytes = base64.b64decode(new_ciphertext_base64)
        
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=storage_path,
            file=ciphertext_bytes,
            file_options={
                "content-type": "application/octet-stream",
                "cache-control": "no-cache"
            }
        )
        
        # Update metadata
        supabase.table('file_metadata')\
            .update({
                'nonce': new_nonce,
                'file_size': len(ciphertext_bytes),
                'updated_at': datetime.now().isoformat()
            })\
            .eq('id', file_id)\
            .eq('user_id', supabase_user_id)\
            .execute()
        
        return JsonResponse({'success': True, 'message': 'File berhasil diupdate'})
        
    except Exception as e:
        print(f"❌ Edit error: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)