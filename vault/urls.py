from django.urls import path

from . import views

urlpatterns = [
    path('upload/', views.upload_view, name='api-file-upload'),
    path('list/', views.list_view, name='api-file-list'),
    path('download/<str:file_id>/', views.download_view, name='api-file-download'),
    path('delete/<str:file_id>/', views.delete_view, name='api-file-delete'),
    path('rename/<str:file_id>/', views.rename_view, name='api-file-rename'),
    path('edit/<str:file_id>/', views.edit_view, name='api-file-edit'),
]
