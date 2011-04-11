function(doc) {
  if (doc.type.indexOf("/type/datasource_permission") >= 0) {
    emit(doc.datasource+":"+doc.user, doc);
    emit(doc.user, doc);
  }
}